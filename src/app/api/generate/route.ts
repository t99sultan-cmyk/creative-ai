import { db } from "@/db";
import { users, creatives } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import crypto from "crypto";
import { checkGenerateRateLimit, rateLimitMessage } from "@/lib/rate-limit";
import { isAdmin } from "@/lib/admin-guard";
import {
  SIGNUP_BONUS_IMPULSES,
  STATIC_DUAL_COST,
  ANIMATED_DUAL_COST,
  staticImageTrioCost,
} from "@/lib/pricing";
import { lintCreativeHtml } from "@/lib/html-linter";
import { notifyAdmin, fmt } from "@/lib/admin-notify";
import {
  AnthropicContentBlock,
  callModel,
  injectPlaceholders,
  ModelChoice,
  unwrapHtml,
} from "@/lib/generation-models";
import { callGptImage } from "@/lib/models/gpt-image";
import { callGemini3ProImage } from "@/lib/models/gemini-3-pro-image";

export const maxDuration = 300;

// ---- Input validation limits ----
const MAX_PROMPT_LEN = 4000;
const MAX_REF_IMAGES = 4;
const MAX_PRODUCT_IMAGES = 4;
const MAX_TOTAL_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_REMIX_HTML_LEN = 10_000_000;

function approxBase64Bytes(dataUrlOrBase64: string): number {
  if (typeof dataUrlOrBase64 !== "string") return 0;
  const idx = dataUrlOrBase64.indexOf(",");
  const b64 = idx >= 0 ? dataUrlOrBase64.slice(idx + 1) : dataUrlOrBase64;
  return Math.floor((b64.length * 3) / 4);
}

/**
 * Минимальный системный промпт. Никаких модулей, никаких anti-slop
 * списков, никаких lib-triggers. Просто бриф → дай HTML.
 *
 * Решение умышленное: после серии экспериментов с навёрнутыми
 * промптами и rule-блоками юзер попросил вернуться к чистому состоянию
 * "только Claude API + Gemini API без надстроек". Модели сами по себе
 * способны писать хорошие креативы — наши rule-стены чаще портили чем
 * помогали. См. коммит-историю для прежней версии (270 строк правил).
 */
const SYSTEM_PROMPT = `You are a senior advertising designer. Create a beautiful, polished HTML advertising creative based on the user's brief.

Format:
- Single self-contained HTML document, from <!DOCTYPE html> to </html>.
- All CSS in <style>, all JS in <script>. Tailwind via CDN is fine.
- Lock to the requested aspect ratio (9:16 vertical or 1:1 square). Use overflow:hidden on body to keep content inside the viewport.

Russian copy by default unless the user's brief uses English.

ANIMATED MODE (when the user message says "Mode: ANIMATED"):
- Load GSAP via CDN: <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
- The final output is rendered as a 15-second video for 9:16 / 10-second for 1:1 at 30 fps. Design for that runtime — not for a webpage.
- Build a RICH, layered motion timeline. Aim for 6-12 separate tween blocks — not one fade-in. Examples of layers: per-letter or per-word headline reveal (use SplitType from CDN if helpful), product slides up + scales in, decorative blobs drift slowly, accent shapes pop with elastic ease, price/CTA tag swings in, a subtle highlight sweep across the headline, particles or grain shimmer.
- Pacing: stagger entrances over the first 4-6 seconds, then HOLD for 9-11 seconds (9:16) / 4-6 seconds (1:1) with ONE subtle ambient motion still alive (e.g. product floating ±8px y over 4s yoyo, or a slow gradient hue-shift on the bg). The frame must NEVER feel static during the hold.
- One-shot, no infinite loops. Don't use repeat:-1 or yoyo:true at the timeline level. CSS @keyframes: prefer animation-iteration-count:1 unless it's a slow ambient bg.
- Smooth eases. Use power3.out, power4.out, expo.out, back.out(1.7), sine.inOut, cubic.inOut. NEVER linear — it looks mechanical at 30 fps.
- Animate only transform (translate/scale/rotate) and opacity for performance. Never width/height/left/top/margin/padding/filter:blur — they jank at 30 fps.
- Add will-change:transform,opacity on animated elements; transform:translateZ(0) on parents to force GPU compositing.
- Optional opt-in libs (load only if the brief asks): tsParticles for confetti/snow, Three.js for 3D depth, Matter.js for physics-based bounces, Pixi.js for glitch/displacement.

STATIC MODE (when the user message says "Mode: STATIC"):
- No animations, no GSAP, no @keyframes. Single perfectly composed frame. Don't load animation scripts.

Return ONLY the raw HTML. No markdown wrapping (\`\`\`html), no commentary.`;

/**
 * POST /api/generate — DUAL MODEL endpoint.
 *
 * Один клик из editor'а → две креатива в параллель:
 *   • Claude Opus 4.7  (model='claude')
 *   • Gemini 3.1 Pro   (model='gemini')
 *
 * Оба ряда сохраняются с одним pairId и `selectedAsBest = null` пока
 * юзер не выберет победителя в UI.
 *
 * Cost: 6 имп. static / 8 имп. animated. При полном падении обеих
 * моделей — full refund. При успехе одной — half-refund + 1 креатив.
 */
export async function POST(req: Request) {
  let deductedUserId: string | null = null;
  let deductedCost = 0;
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Не авторизован" }), { status: 401 });
    }

    const body = await req.json();
    const {
      prompt,
      isAnimated,
      format,
      referenceImagesBase64,
      productImagesBase64,
      remixHtmlCode,
      remixScreenshotBase64,
      strictClone,
    } = body;

    // Variant count (static image-gen path only): 1, 2, or 3 images per
    // model. Default to 2. Anything else gets clamped — the router
    // never trusts client input on cost-sensitive numbers.
    const variantCount: 1 | 2 | 3 =
      body?.variantCount === 1 ? 1 : body?.variantCount === 3 ? 3 : 2;

    // ---- Input validation ----
    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Промпт не может быть пустым." }), { status: 400 });
    }
    if (prompt.length > MAX_PROMPT_LEN) {
      return new Response(
        JSON.stringify({ error: `Промпт слишком длинный (${prompt.length} симв., максимум ${MAX_PROMPT_LEN}).` }),
        { status: 400 }
      );
    }
    if (format !== "9:16" && format !== "1:1") {
      return new Response(JSON.stringify({ error: "Неверный формат. Ожидается 9:16 или 1:1." }), { status: 400 });
    }
    const refs = Array.isArray(referenceImagesBase64) ? referenceImagesBase64 : [];
    const prods = Array.isArray(productImagesBase64) ? productImagesBase64 : [];
    if (refs.length > MAX_REF_IMAGES) {
      return new Response(JSON.stringify({ error: `Максимум ${MAX_REF_IMAGES} референсных изображений.` }), { status: 400 });
    }
    if (prods.length > MAX_PRODUCT_IMAGES) {
      return new Response(JSON.stringify({ error: `Максимум ${MAX_PRODUCT_IMAGES} фото продукта.` }), { status: 400 });
    }
    let totalImgBytes = 0;
    for (const img of [...refs, ...prods]) totalImgBytes += approxBase64Bytes(img);
    if (remixScreenshotBase64) totalImgBytes += approxBase64Bytes(remixScreenshotBase64);
    if (totalImgBytes > MAX_TOTAL_IMAGE_BYTES) {
      return new Response(
        JSON.stringify({
          error: `Слишком большой объём изображений (${(totalImgBytes / 1024 / 1024).toFixed(1)} МБ). Максимум ${(MAX_TOTAL_IMAGE_BYTES / 1024 / 1024).toFixed(0)} МБ.`,
        }),
        { status: 413 }
      );
    }
    if (typeof remixHtmlCode === "string" && remixHtmlCode.length > MAX_REMIX_HTML_LEN) {
      return new Response(
        JSON.stringify({ error: `Слишком большой HTML в remix-контексте (${remixHtmlCode.length} симв.).` }),
        { status: 413 }
      );
    }

    // ---- Rate limit (admins bypass) ----
    const adminBypass = await isAdmin();
    if (!adminBypass) {
      const rl = await checkGenerateRateLimit(userId);
      if (!rl.ok) {
        return new Response(
          JSON.stringify({ error: rateLimitMessage(rl), rateLimit: rl }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(rl.retryAfterSec),
            },
          }
        );
      }
    }

    const cost = isAnimated
      ? ANIMATED_DUAL_COST
      : staticImageTrioCost(variantCount);

    // ---- Lazy-create user ----
    const userRecords = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (userRecords.length === 0) {
      const resp = await fetch("https://api.clerk.com/v1/users/" + userId, {
        headers: { Authorization: "Bearer " + process.env.CLERK_SECRET_KEY }
      });
      if (resp.ok) {
        const clerkUser = await resp.json();
        await db.insert(users).values({
          id: userId,
          email: clerkUser.email_addresses[0].email_address,
          name: clerkUser.first_name || "Пользователь",
          impulses: SIGNUP_BONUS_IMPULSES,
        });
      }
    }

    // ---- Atomic deduct ----
    const deducted = await db.update(users)
      .set({ impulses: sql`${users.impulses} - ${cost}` })
      .where(and(eq(users.id, userId), gte(users.impulses, cost)))
      .returning({ impulses: users.impulses });

    if (deducted.length === 0) {
      return new Response(
        JSON.stringify({ error: "Недостаточно импульсов на балансе. Пожалуйста, пополните счет." }),
        { status: 400 }
      );
    }

    deductedUserId = userId;
    deductedCost = cost;

    // ============================================================
    // STATIC IMAGE PATH — Nano Banana × N + GPT-Image-1 × N.
    // Direct image generation (no HTML). Animated mode falls through
    // to the legacy Claude+Gemini HTML pipeline below.
    // ============================================================
    if (!isAnimated) {
      // Take the first product image (if any) — Nano Banana accepts
      // multi-image input but GPT-Image edits endpoint takes a single
      // image. To keep both models comparing apples-to-apples, pass
      // exactly one to each.
      let productImageBase64: string | undefined;
      let productImageMime: string | undefined;
      if (prods.length > 0) {
        const first = prods[0];
        if (typeof first === "string") {
          if (first.startsWith("data:")) {
            productImageMime = first.split(";")[0].split(":")[1];
            productImageBase64 = first.split(",")[1];
          } else {
            productImageBase64 = first;
            productImageMime = "image/png";
          }
        }
      }

      type Variant = {
        model: "gemini-3-pro-image" | "gpt-image-2";
        ok: boolean;
        creativeId?: string;
        imageBase64?: string;
        mediaType?: string;
        apiCostKzt?: number;
        error?: string;
      };

      const tasks: Array<{ model: Variant["model"]; promise: Promise<unknown> }> = [];
      for (let i = 0; i < variantCount; i++) {
        tasks.push({
          model: "gemini-3-pro-image",
          promise: callGemini3ProImage({
            prompt,
            productImageBase64,
            productImageMime,
            format: format as "9:16" | "1:1",
          }),
        });
      }
      for (let i = 0; i < variantCount; i++) {
        tasks.push({
          model: "gpt-image-2",
          promise: callGptImage({
            prompt,
            productImageBase64,
            productImageMime,
            format: format as "9:16" | "1:1",
          }),
        });
      }

      const settled = await Promise.allSettled(tasks.map((t) => t.promise));
      const variants: Variant[] = settled.map((s, i) => {
        const model = tasks[i].model;
        if (s.status === "fulfilled") {
          const v = s.value as { imageBase64: string; mediaType: string; apiCostKzt: number };
          return {
            model,
            ok: true,
            imageBase64: v.imageBase64,
            mediaType: v.mediaType,
            apiCostKzt: v.apiCostKzt,
          };
        }
        const errMsg = s.reason instanceof Error ? s.reason.message : String(s.reason);
        console.error(`[generate:${model}] failed:`, errMsg);
        return { model, ok: false, error: errMsg };
      });

      const successCount = variants.filter((v) => v.ok).length;
      if (successCount === 0) {
        const sampleErr =
          variants.find((v) => v.error)?.error ?? "all models failed silently";
        throw new Error(
          `All ${variants.length} image generations failed. Sample: ${sampleErr}`,
        );
      }

      // Insert successful rows under one shared pairId.
      const pairId = crypto.randomUUID();
      for (const v of variants) {
        if (v.ok) v.creativeId = crypto.randomUUID();
      }

      const insertedIds: string[] = [];
      try {
        for (const v of variants) {
          if (!v.ok || !v.creativeId || !v.imageBase64) continue;
          const dataUrl = `data:${v.mediaType ?? "image/png"};base64,${v.imageBase64}`;
          await db.insert(creatives).values({
            id: v.creativeId,
            userId,
            prompt,
            format,
            cost,
            apiCostKzt: v.apiCostKzt ?? 0,
            imageUrl: dataUrl,
            model: v.model,
            pairId,
          });
          insertedIds.push(v.creativeId);
        }
      } catch (insertErr) {
        if (insertedIds.length > 0) {
          try {
            await db.delete(creatives).where(eq(creatives.pairId, pairId));
            console.warn(`[generate saga] rolled back ${insertedIds.length} insert(s)`);
          } catch (rollbackErr) {
            console.error(`[generate saga] ROLLBACK FAILED:`, {
              pairId,
              insertedIds,
              rollbackErr,
            });
            try {
              notifyAdmin(
                `🔴 *Saga rollback FAILED*\n\n*pairId:* \`${pairId}\`\n*ids:* ${insertedIds.join(", ")}\n\n\`DELETE FROM creative WHERE pair_id = '${pairId}';\``,
              );
            } catch {}
          }
        }
        throw insertErr;
      }

      // Partial refund: bill upfront for 2 × variantCount images; if K
      // succeed, refund (cost × (N-K) / N).
      const expectedOutputs = variants.length;
      let partialRefunded = 0;
      if (successCount < expectedOutputs) {
        partialRefunded = Math.floor(
          (cost * (expectedOutputs - successCount)) / expectedOutputs,
        );
        if (partialRefunded > 0) {
          await db
            .update(users)
            .set({ impulses: sql`${users.impulses} + ${partialRefunded}` })
            .where(eq(users.id, userId));
          console.warn(
            `[Partial refund] ${expectedOutputs - successCount}/${expectedOutputs} failed; returned ${partialRefunded} imp.`,
          );
        }
        deductedCost = cost - partialRefunded;
      } else {
        deductedCost = 0;
      }

      // Admin notify (fire-and-forget) — surface partial failures so
      // we can debug per-model issues.
      void (async () => {
        try {
          if (successCount < expectedOutputs) {
            const failed = variants.filter((v) => !v.ok);
            const summary = failed
              .map((v) => `${v.model}: ${fmt.short(v.error ?? "?", 120)}`)
              .join(" | ");
            const okPerModel = (m: Variant["model"]) =>
              variants.filter((v) => v.model === m && v.ok).length;
            notifyAdmin(
              `⚠️ *Image-gen partial fail*\n\n*Юзер:* \`${fmt.esc(userId)}\`\n*Модели:* NB-Pro ${okPerModel("gemini-3-pro-image")}/${variantCount}, GPT2 ${okPerModel("gpt-image-2")}/${variantCount}\n*Ошибки:* ${fmt.esc(fmt.short(summary, 350))}\n*Возврат:* ${partialRefunded} имп.`,
            );
          }
        } catch (e) {
          console.warn("[notifyAdmin] image-gen notify failed:", e);
        }
      })().catch(() => undefined);

      return new Response(
        JSON.stringify({
          pairId,
          variants: variants.map((v) => ({
            creativeId: v.creativeId ?? null,
            model: v.model,
            ok: v.ok,
            imageUrl:
              v.ok && v.imageBase64
                ? `data:${v.mediaType ?? "image/png"};base64,${v.imageBase64}`
                : null,
            error: v.error ?? null,
          })),
          partialRefunded,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // ============================================================
    // ANIMATED HTML PATH — Claude + Gemini in parallel.
    // Existing pipeline; will be replaced once Veo 3 / Kling are wired.
    // ============================================================

    // ---- Build user-content blocks ----
    const baseContent: AnthropicContentBlock[] = [];
    const preservedImages: string[] = [];
    let cleanedRemixHtmlCode = remixHtmlCode;

    if (cleanedRemixHtmlCode) {
      const base64Regex = /data:image\/[^"']+/g;
      cleanedRemixHtmlCode = cleanedRemixHtmlCode.replace(base64Regex, (match: string) => {
        const id = preservedImages.length;
        preservedImages.push(match);
        return `REMIX_PRESERVED_IMG_${id}`;
      });

      baseContent.push({
        type: "text",
        text: `Format: ${format}\nMode: ${isAnimated ? "ANIMATED" : "STATIC"}\nSTRICT-CLONE: ${strictClone ? "yes" : "no"}\n\nUser brief: ${prompt}\n\nThis is a REMIX. Re-use the layout and core vibe of this previous HTML, but apply the user's changes:\n\n\`\`\`html\n${cleanedRemixHtmlCode}\n\`\`\``
      });

      if (remixScreenshotBase64) {
        baseContent.push({
          type: "text",
          text: "Visual rendering of the current HTML for context:"
        });
        let mimeType = "image/png";
        let data = remixScreenshotBase64;
        if (data.startsWith("data:")) {
          mimeType = data.split(";")[0].split(":")[1];
          data = data.split(",")[1];
        }
        baseContent.push({
          type: "image",
          source: { type: "base64", media_type: mimeType, data }
        });
      }
    } else {
      baseContent.push({
        type: "text",
        text: `Format: ${format}\nMode: ${isAnimated ? "ANIMATED" : "STATIC"}\nSTRICT-CLONE: ${strictClone ? "yes" : "no"}\n\nUser brief: ${prompt}`,
      });
    }

    // Reference images.
    if (refs.length > 0) {
      baseContent.push({
        type: "text",
        text: strictClone
          ? "REFERENCE-CLONE: replicate the layout, colors, fonts of these reference image(s) as closely as possible. Adapt only the copy (Russian) and any product image to the brief."
          : "Reference image(s) for visual inspiration:",
      });
      for (const imgUrl of refs) {
        let mimeType = "image/jpeg";
        let data = imgUrl;
        if (data.startsWith("data:")) {
          mimeType = data.split(";")[0].split(":")[1];
          data = data.split(",")[1];
        }
        baseContent.push({
          type: "image",
          source: { type: "base64", media_type: mimeType, data }
        });
      }
    }

    // Product images.
    if (prods.length > 0) {
      baseContent.push({
        type: "text",
        text: "Product images to integrate (use placeholders PRODUCT_IMG_0, PRODUCT_IMG_1 in your HTML img tags):",
      });
      for (const imgUrl of prods) {
        let mimeType = "image/png";
        let data = imgUrl;
        if (data.startsWith("data:")) {
          mimeType = data.split(";")[0].split(":")[1];
          data = data.split(",")[1];
        }
        baseContent.push({
          type: "image",
          source: { type: "base64", media_type: mimeType, data }
        });
      }
    }

    // ---- Run Claude + Gemini in parallel (animated HTML path) ----
    const tasks: Promise<unknown>[] = [
      callModel("claude", SYSTEM_PROMPT, baseContent),
      callModel("gemini", SYSTEM_PROMPT, baseContent),
    ];
    const settled = await Promise.allSettled(tasks);

    type PerModelResult = {
      model: ModelChoice;
      ok: boolean;
      html?: string;
      apiCostKzt?: number;
      error?: string;
      creativeId?: string;
    };
    const results: PerModelResult[] = [
      { model: "claude", ok: false },
      { model: "gemini", ok: false },
    ];

    settled.forEach((s, i) => {
      const r = results[i];
      if (s.status !== "fulfilled") {
        r.error = s.reason instanceof Error ? s.reason.message : String(s.reason);
        console.error(`[generate:${r.model}] failed:`, r.error);
        return;
      }
      const value = s.value as { html: string; apiCostKzt: number };
      const cleaned = injectPlaceholders(unwrapHtml(value.html), prods, preservedImages);
      try {
        const lintIssues = lintCreativeHtml(cleaned);
        if (lintIssues.length > 0) {
          const high = lintIssues.filter((x) => x.severity === "high").length;
          console.log(
            `[lint:${r.model}] ${lintIssues.length} (${high} high):`,
            lintIssues.map((x) => x.code).join(", "),
          );
        }
      } catch (e) {
        console.warn(`[lint:${r.model}] linter crashed:`, e);
      }
      r.ok = true;
      r.html = cleaned;
      r.apiCostKzt = value.apiCostKzt;
    });

    const successCount = results.filter((r) => r.ok).length;

    if (successCount === 0) {
      throw new Error(
        `Both models failed. Claude: ${results[0].error || "?"} / Gemini: ${results[1].error || "?"}`,
      );
    }

    // ---- Insert successful rows (saga: rollback on partial failure) ----
    const pairId = crypto.randomUUID();
    for (const r of results) {
      if (r.ok) r.creativeId = crypto.randomUUID();
    }

    const insertedIds: string[] = [];
    try {
      for (const r of results) {
        if (!r.ok || !r.creativeId || !r.html) continue;
        await db.insert(creatives).values({
          id: r.creativeId,
          userId,
          prompt,
          format,
          cost,
          apiCostKzt: r.apiCostKzt ?? 0,
          htmlCode: r.html,
          model: r.model,
          pairId,
        });
        insertedIds.push(r.creativeId);
      }
    } catch (insertErr) {
      if (insertedIds.length > 0) {
        try {
          await db.delete(creatives).where(eq(creatives.pairId, pairId));
          console.warn(`[generate saga] rolled back ${insertedIds.length} insert(s)`);
        } catch (rollbackErr) {
          console.error(`[generate saga] ROLLBACK FAILED:`, { pairId, insertedIds, rollbackErr });
          try {
            notifyAdmin(
              `🔴 *Saga rollback FAILED*\n\n*pairId:* \`${pairId}\`\n*ids:* ${insertedIds.join(", ")}\n\n\`DELETE FROM creative WHERE pair_id = '${pairId}';\``,
            );
          } catch {}
        }
      }
      throw insertErr;
    }

    // ---- Partial refund based on success ratio ----
    // Animated bills upfront for 2 expected outputs (Claude + Gemini).
    // If only K succeed, refund (cost × (N-K) / N).
    const expectedOutputs = results.length;
    let partialRefunded = 0;
    if (successCount < expectedOutputs) {
      partialRefunded = Math.floor((cost * (expectedOutputs - successCount)) / expectedOutputs);
      if (partialRefunded > 0) {
        await db.update(users)
          .set({ impulses: sql`${users.impulses} + ${partialRefunded}` })
          .where(eq(users.id, userId));
        console.warn(`[Partial refund] ${expectedOutputs - successCount}/${expectedOutputs} failed; returned ${partialRefunded} imp.`);
      }
      deductedCost = cost - partialRefunded;
    } else {
      deductedCost = 0;
    }

    // ---- Admin notify (fire-and-forget) ----
    void (async () => {
      try {
        const creativeCount = await db
          .select({ c: sql<number>`count(*)::int` })
          .from(creatives)
          .where(eq(creatives.userId, userId));
        const totalCreatives = creativeCount[0]?.c ?? 0;
        if (totalCreatives <= 2 && totalCreatives > 0 && totalCreatives === successCount) {
          const u = await db
            .select({ email: users.email, name: users.name })
            .from(users)
            .where(eq(users.id, userId));
          notifyAdmin(
            `✨ *Первая генерация у юзера*\n\n` +
            `*Email:* ${fmt.esc(u[0]?.email ?? userId)}\n` +
            (u[0]?.name ? `*Имя:* ${fmt.esc(u[0].name)}\n` : '') +
            `*Модели:* Claude=${results[0].ok ? "✓" : "✗"} Gemini=${results[1].ok ? "✓" : "✗"}\n` +
            `*Формат:* ${format} ${isAnimated ? '(анимация)' : '(статика)'}\n` +
            `*ТЗ:* ${fmt.esc(fmt.short(prompt, 200))}`,
          );
        }
        if (successCount === 1) {
          const failed = results.find((r) => !r.ok);
          notifyAdmin(
            `⚠️ *Одна модель упала*\n\n*Юзер:* ${fmt.esc(userId)}\n*Упала:* ${failed?.model}\n*Причина:* ${fmt.esc(fmt.short(failed?.error || "?", 250))}\n*Возврат:* ${partialRefunded} имп.`,
          );
        }
      } catch (e) {
        console.warn('[notifyAdmin] post-success failed:', e);
      }
    })().catch(() => undefined);

    const respondHtml = (r: PerModelResult | undefined) =>
      r && r.ok ? { creativeId: r.creativeId!, code: r.html! } : { error: r?.error || "Unknown error" };

    const claudeR = results.find((r) => r.model === "claude");
    const geminiR = results.find((r) => r.model === "gemini");

    return new Response(
      JSON.stringify({
        pairId,
        claude: respondHtml(claudeR),
        gemini: respondHtml(geminiR),
        partialRefunded,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    if (deductedCost > 0 && deductedUserId) {
      try {
        await db.update(users)
          .set({ impulses: sql`${users.impulses} + ${deductedCost}` })
          .where(eq(users.id, deductedUserId));
        console.warn(`[Refund] Returned ${deductedCost} imp. to ${deductedUserId}`);
      } catch (refundErr) {
        console.error('[Refund FAILED]', { userId: deductedUserId, cost: deductedCost, refundErr });
      }
    }
    console.error('Generation error:', error);

    try {
      let errEmail = "(не идентифицирован)";
      if (deductedUserId) {
        const u = await db.select({ email: users.email }).from(users).where(eq(users.id, deductedUserId));
        if (u[0]?.email) errEmail = u[0].email;
      }
      notifyAdmin(
        `🔴 *Ошибка генерации*\n\n*Юзер:* ${fmt.esc(errEmail)}\n*Ошибка:* ${fmt.esc(fmt.short(error?.message || String(error), 250))}\n` +
        (deductedCost > 0 ? `\n_Импульсы (${deductedCost}) возвращены._` : ''),
      );
    } catch (notifyErr) {
      console.warn('[notifyAdmin] error-path notify failed:', notifyErr);
    }

    return Response.json({ error: error.message || 'Error generating dual-model content' }, { status: 500 });
  }
}
