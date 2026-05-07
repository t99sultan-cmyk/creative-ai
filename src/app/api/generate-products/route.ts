import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { checkProductsRateLimit, rateLimitMessage } from "@/lib/rate-limit-products";
import { and, eq, gte, sql } from "drizzle-orm";
import { computeProductGenCost, PRODUCTS_DEFAULT_CARDS } from "@/lib/pricing";
import { callClaude, type AnthropicContentBlock } from "@/lib/generation-models";
import { callGemini3ProImage } from "@/lib/models/gemini-3-pro-image";
import {
  buildProductsSystemPrompt,
  extractImagePromptsFromHtml,
  substituteImagePlaceholders,
  validateGeneratedHtml,
  type ContentLanguage,
} from "@/lib/site-system-prompts";
import { makeLogger } from "@/lib/logger";

const log = makeLogger("generate-products");

/**
 * POST /api/generate-products — universal marketplace product cards (v1).
 *
 * Universal format per the user's spec — no Kaspi/WB-specific
 * adaptation. The AI produces a "contact sheet" HTML with card-count
 * 1:1 image cells, each with a {{IMAGE_N}} placeholder. The seller
 * downstream-adapts per marketplace by cropping / repositioning text.
 *
 * Same v2 architecture as /api/generate-site:
 *   - 1 variant from Claude Opus 4.7.
 *   - Variable card count (3-12, default 6).
 *   - Dynamic image slots from <img alt> alt-text.
 *   - Language: ru / en / kz.
 *   - Cost via computeProductGenCost("product-cards", count).
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

    const cardCount = clampInt(body?.cardCount, 3, 12, PRODUCTS_DEFAULT_CARDS);
    const language = parseLanguage(body?.language);

    if (!brief || brief.length < 30) {
      return new Response(
        JSON.stringify({ error: "Бриф слишком короткий — заполни хотя бы 30 символов." }),
        { status: 400 },
      );
    }

    const cost = computeProductGenCost("product-cards", cardCount);
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

    const systemPrompt = buildProductsSystemPrompt({ cardCount, language });
    const userText = buildUserMessage({ brief, cityCountry, referenceUrls, extraContext, hasRefImages: referenceImages.length > 0 });

    const userContent: AnthropicContentBlock[] = [{ type: "text", text: userText }];
    if (productPhoto) {
      const parsed = parseDataUrl(productPhoto);
      if (parsed) {
        userContent.push({
          type: "text",
          text: "PRODUCT PHOTO (treat as ground truth — preserve color, shape, material, label across all card alt-text descriptions):",
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
    const v = validateGeneratedHtml(rawHtml, { product: "product-cards", expectedCount: cardCount });
    if (!v.ok) {
      await refund();
      log.warn("html_validation_failed", { userId, cardCount, reason: v.reason, actualCount: v.actualCount });
      const msg =
        v.reason === "wrong_count"
          ? `Получилось ${v.actualCount ?? "?"} карточек вместо ${cardCount}. Попробуй ещё раз — импульсы возвращены.`
          : v.reason === "no_close_tag" || v.reason === "no_doctype"
          ? "Карточки не уместились в лимит модели — попробуй меньше (3-8). Импульсы возвращены."
          : "Claude вернул пустой/неполный HTML — попробуй ещё раз. Импульсы возвращены.";
      return new Response(JSON.stringify({ error: msg }), { status: 502 });
    }

    const imagePrompts = extractImagePromptsFromHtml(rawHtml, cardCount);
    const productPhotoData = productPhoto ? parseDataUrl(productPhoto) : null;

    const imagePromises = Array.from(imagePrompts.entries()).map(async ([token, prompt]) => {
      try {
        const res = await callGemini3ProImage({
          prompt: `${prompt}\n\nProduct context: ${brief.slice(0, 300)}`,
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
      JSON.stringify({ ok: true, html: finalHtml, cost, cardCount }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    await refund();
    log.error("generate_failed", { userId: deductedUserId ?? undefined }, err);
    return new Response(
      JSON.stringify({ error: err?.message || "Ошибка генерации карточек" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

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
    t += `\n\nReference URLs:\n${opts.referenceUrls.map((u) => `• ${u}`).join("\n")}`;
  }
  if (opts.extraContext) t += `\n\nAdditional context:\n${opts.extraContext}`;
  if (opts.hasRefImages) t += `\n\nReference images attached: study composition + lighting style. Adopt the visual STYLE.`;
  return t;
}
