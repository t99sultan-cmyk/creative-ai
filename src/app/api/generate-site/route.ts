import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth/clerk-compat";
import { checkProductsRateLimit, rateLimitMessage } from "@/lib/rate-limit-products";
import { and, eq, gte, sql } from "drizzle-orm";
import { computeProductGenCost, SITE_DEFAULT_SECTIONS } from "@/lib/pricing";
import { callClaude, type AnthropicContentBlock } from "@/lib/generation-models";
import { callGemini3ProImage } from "@/lib/models/gemini-3-pro-image";
import {
  buildSiteSystemPrompt,
  extractImagePromptsFromHtml,
  substituteImagePlaceholders,
  validateGeneratedHtml,
  type ContentLanguage,
} from "@/lib/site-system-prompts";
import { makeLogger } from "@/lib/logger";

const log = makeLogger("generate-site");

/**
 * POST /api/generate-site — single-page landing generator (v2).
 *
 * v2 changes from v1:
 *   - 1 variant from Claude Opus 4.7 only (was Claude + Gemini parallel).
 *   - Variable section count (3-12, default 6) — passed to system prompt.
 *   - Dynamic image slots driven by Claude's alt-text in <img> tags.
 *   - Language selector: ru / en / kz.
 *   - Cost computed via computeProductGenCost("site", count) — base 30⚡
 *     for default count + 3⚡ per extra section.
 *
 * Body:
 *   {
 *     brief: string,                  // required, 30+ chars
 *     sectionCount?: number,          // 3-12, default 6
 *     language?: "ru" | "en" | "kz",  // default "ru"
 *     cityCountry?: string,
 *     productPhoto?: string,          // single base64 photo of the product
 *     referenceImages?: string[],     // up to 3 style references
 *     referenceUrls?: string[],
 *     extraContext?: string,
 *   }
 *
 * Returns: { ok, html, cost }
 */
export async function POST(req: Request) {
  let deductedUserId: string | null = null;
  let deductedCost = 0;

  const refund = async () => {
    if (deductedCost > 0 && deductedUserId) {
      try {
        await db
          .update(users)
          .set({ impulses: sql`${users.impulses} + ${deductedCost}` })
          .where(eq(users.id, deductedUserId));
      } catch (err) {
        log.error("refund_failed", { userId: deductedUserId ?? undefined }, err);
      }
    }
  };

  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Не авторизован" }), { status: 401 });
    }

    // Rate limit — 3 generations per minute, 12 per hour. Stops bot
    // fanout against this expensive endpoint (Claude + N image gens).
    const rl = checkProductsRateLimit(userId);
    if (!rl.ok) {
      return new Response(JSON.stringify({ error: rateLimitMessage(rl) }), {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSec), "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const brief = typeof body?.brief === "string" ? body.brief.trim() : "";
    const cityCountry = typeof body?.cityCountry === "string" ? body.cityCountry.trim() : "";
    const productPhoto = typeof body?.productPhoto === "string" && body.productPhoto.startsWith("data:")
      ? body.productPhoto : "";
    const referenceImages: string[] = Array.isArray(body?.referenceImages)
      ? body.referenceImages.filter((s: unknown) => typeof s === "string" && s.startsWith("data:")).slice(0, 3)
      : [];
    const referenceUrls: string[] = Array.isArray(body?.referenceUrls)
      ? body.referenceUrls.filter((u: unknown) => typeof u === "string" && u.trim().length > 0).slice(0, 5)
      : [];
    const extraContext = typeof body?.extraContext === "string" ? body.extraContext.trim() : "";

    const sectionCount = clampInt(body?.sectionCount, 3, 12, SITE_DEFAULT_SECTIONS);
    const language = parseLanguage(body?.language);

    if (!brief || brief.length < 30) {
      return new Response(
        JSON.stringify({ error: "Бриф слишком короткий — заполни хотя бы 30 символов." }),
        { status: 400 },
      );
    }

    // Atomic deduct based on selected count.
    const cost = computeProductGenCost("site", sectionCount);
    const deducted = await db
      .update(users)
      .set({ impulses: sql`${users.impulses} - ${cost}` })
      .where(and(eq(users.id, userId), gte(users.impulses, cost)))
      .returning({ impulses: users.impulses });
    if (deducted.length === 0) {
      return new Response(
        JSON.stringify({ error: `Нужно ${cost} импульсов на балансе.` }),
        { status: 400 },
      );
    }
    deductedUserId = userId;
    deductedCost = cost;

    // Phase 1: generate HTML structure via Claude.
    const systemPrompt = buildSiteSystemPrompt({ sectionCount, language });
    const userText = buildUserMessage({ brief, cityCountry, referenceUrls, extraContext, hasRefImages: referenceImages.length > 0 });

    const userContent: AnthropicContentBlock[] = [{ type: "text", text: userText }];
    // Pass the product photo to Claude FIRST (before refs) so the model
    // anchors copy on the actual product (color, material, packaging).
    // Without this, Claude wrote generic copy that often contradicted the
    // image-gen output. Reference images come after — they shape style,
    // not content.
    if (productPhoto) {
      const parsed = parseDataUrl(productPhoto);
      if (parsed) {
        userContent.push({
          type: "text",
          text: "PRODUCT PHOTO (treat as ground truth for what the product looks like — color, shape, material, label, packaging):",
        });
        userContent.push({ type: "image", source: { type: "base64", media_type: parsed.mime, data: parsed.base64 } });
      }
    }
    for (const img of referenceImages) {
      const parsed = parseDataUrl(img);
      if (parsed) userContent.push({ type: "image", source: { type: "base64", media_type: parsed.mime, data: parsed.base64 } });
    }

    const claudeResult = await callClaude(systemPrompt, userContent);
    const rawHtml = claudeResult.html;

    // Multi-check validation: completeness + correct section count.
    const v = validateGeneratedHtml(rawHtml, { product: "site", expectedCount: sectionCount });
    if (!v.ok) {
      await refund();
      log.warn("html_validation_failed", { userId, sectionCount, reason: v.reason, actualCount: v.actualCount });
      const msg =
        v.reason === "wrong_count"
          ? `Сайт собрался на ${v.actualCount ?? "?"} секций вместо ${sectionCount}. Попробуй ещё раз — импульсы возвращены.`
          : v.reason === "no_close_tag" || v.reason === "no_doctype"
          ? "Сайт не уместился в лимит модели — попробуй меньше секций (3-8). Импульсы возвращены."
          : "Claude вернул пустой/неполный HTML — попробуй ещё раз. Импульсы возвращены.";
      return new Response(JSON.stringify({ error: msg }), { status: 502 });
    }

    // Phase 2: extract image prompts from <img alt="..."> tags, generate
    // image per slot in parallel via Gemini 3 Pro Image. If user provided
    // a productPhoto, attach it to every image-gen call so the product
    // looks consistent across the landing.
    const imagePrompts = extractImagePromptsFromHtml(rawHtml, sectionCount);
    const productPhotoData = productPhoto ? parseDataUrl(productPhoto) : null;

    const imagePromises = Array.from(imagePrompts.entries()).map(async ([token, prompt]) => {
      try {
        const res = await callGemini3ProImage({
          prompt: `${prompt}\n\nLanding context: ${brief.slice(0, 300)}`,
          format: "1:1",
          regionHint: cityCountry || undefined,
          productImageBase64: productPhotoData?.base64,
          productImageMime: productPhotoData?.mime,
        });
        return [token, `data:${res.mediaType};base64,${res.imageBase64}`] as const;
      } catch (err) {
        log.warn("image_slot_failed", { userId, token }, err);
        return [token, ""] as const;
      }
    });

    const imageEntries = await Promise.all(imagePromises);
    const imageMap = new Map<string, string>(imageEntries);
    const finalHtml = substituteImagePlaceholders(rawHtml, imageMap);

    return new Response(
      JSON.stringify({ ok: true, html: finalHtml, cost, sectionCount }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    await refund();
    log.error("generate_failed", { userId: deductedUserId ?? undefined }, err);
    return new Response(
      JSON.stringify({ error: err?.message || "Ошибка генерации сайта" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

// ─── helpers ──────────────────────────────────────────────────────

function clampInt(v: unknown, min: number, max: number, dflt: number): number {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function parseLanguage(v: unknown): ContentLanguage {
  const s = typeof v === "string" ? v.toLowerCase() : "";
  if (s === "en" || s === "kz") return s;
  return "ru";
}

function parseDataUrl(s: string): { mime: string; base64: string } | null {
  if (!s.startsWith("data:")) return null;
  const comma = s.indexOf(",");
  if (comma < 0) return null;
  const mime = s.slice(5, comma).split(";")[0] || "image/png";
  const base64 = s.slice(comma + 1);
  return base64 ? { mime, base64 } : null;
}

function buildUserMessage(opts: {
  brief: string;
  cityCountry: string;
  referenceUrls: string[];
  extraContext: string;
  hasRefImages: boolean;
}): string {
  let t = `Brief / ТЗ:\n${opts.brief}`;
  if (opts.cityCountry) t += `\n\nGeo / market: ${opts.cityCountry}`;
  if (opts.referenceUrls.length > 0) {
    t += `\n\nReference URLs (use your knowledge of how those sites look — adopt their style/structure):\n${opts.referenceUrls.map((u) => `• ${u}`).join("\n")}`;
  }
  if (opts.extraContext) t += `\n\nAdditional context:\n${opts.extraContext}`;
  if (opts.hasRefImages) {
    t += `\n\nReference images attached below: study composition, palette, typography, section rhythm. Adopt VISUAL STYLE (not content).`;
  }
  return t;
}
