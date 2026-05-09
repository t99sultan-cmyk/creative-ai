import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth/clerk-compat";
import { and, eq, gte, sql } from "drizzle-orm";
import { REFINE_BLOCK_COST } from "@/lib/pricing";
import { callClaude } from "@/lib/generation-models";
import { validateGeneratedHtml } from "@/lib/site-system-prompts";
import { checkProductsRateLimit, rateLimitMessage } from "@/lib/rate-limit-products";
import { makeLogger } from "@/lib/logger";

const log = makeLogger("refine-html");

/**
 * Replace embedded data: URLs in the HTML with placeholders before
 * sending to Claude, then restore them in the response. Two wins:
 *   1. Token cost — base64 images can dominate input tokens (a 25-slide
 *      deck with 16:9 PNG hero shots is ~500KB → ~125K tokens raw).
 *      Stripping leaves Claude with maybe 5-10K tokens of structure.
 *   2. Preservation — Claude can't truncate or "summarize" what it
 *      doesn't see. Restoring is byte-perfect.
 */
function stripDataUrls(html: string): { stripped: string; map: Map<string, string> } {
  const map = new Map<string, string>();
  let n = 0;
  // Match <img src="data:..." ...> — both quote styles. Use [\s\S]
  // for multiline tolerance instead of `s` flag (tsconfig target is
  // ES2017 which predates regex DOTALL).
  const stripped = html.replace(
    /(<img\b[\s\S]*?\bsrc=["'])(data:[^"']+)(["'])/gi,
    (_full, before, dataUrl, after) => {
      const token = `__KEEP_DATAURL_${n++}__`;
      map.set(token, dataUrl);
      return `${before}${token}${after}`;
    },
  );
  return { stripped, map };
}

function restoreDataUrls(html: string, map: Map<string, string>): string {
  let out = html;
  for (const [token, dataUrl] of map) {
    // Token chars are URL-safe, no regex escaping needed.
    out = out.split(token).join(dataUrl);
  }
  return out;
}

/**
 * POST /api/refine-html — block-level refinement of a generated HTML
 * artifact (site / presentation / product cards).
 *
 * The user submits the full HTML they want to tweak + a free-text
 * instruction ("поменяй заголовок на 'Звук без проводов'", "сделай фон
 * темнее", "убери 3-ю карточку"). Claude applies the change with the
 * smallest possible diff and returns the full updated HTML.
 *
 * Why whole-document refine instead of true block-by-block:
 *   - Block selectors are fragile (Claude's HTML uses inline classes,
 *     no stable IDs). A click-to-select UI requires DOM-aware refine.
 *   - Whole-doc refine is simpler to ship and works with any user
 *     intent ("change just X" → "delete Y" → "swap colors").
 *   - Cost stays flat (one Claude call) — REFINE_BLOCK_COST = 5⚡.
 *
 * Future v2: add an optional `blockIndex` param to scope changes for
 * cost savings + protection against unrelated mutations.
 *
 * Body:
 *   { html: string, instruction: string }
 *
 * Returns:
 *   { ok: true, html: string, cost: number }
 */

const REFINE_SYSTEM_PROMPT = `You are an HTML editor. The user gives you a complete HTML document and a single instruction. Apply the instruction with the SMALLEST possible diff and return the full updated HTML.

HARD RULES:
- Output the COMPLETE HTML document, from <!doctype html> to </html>.
- Change only what the instruction asks for. Leave everything else BYTE-IDENTICAL.
- Do NOT redesign, restructure, or "improve" anything that isn't explicitly requested.
- The image src attributes contain placeholder tokens like __KEEP_DATAURL_0__ — these are protected slots that the server will restore to real images after you respond. KEEP these tokens VERBATIM, never modify, paraphrase, shorten, or remove them. Each token must appear exactly once in your output exactly as it appears in the input.
- Preserve all CSS classes, inline styles, and Tailwind directives.
- If the instruction is ambiguous, make the most conservative interpretation.
- If the instruction asks to delete an entire section/slide/card, remove that section cleanly. The corresponding __KEEP_DATAURL_N__ tokens that were inside the deleted block are then OK to drop along with it.
- If the instruction asks to translate or rewrite copy, only change the targeted text — never reword anything else.

Output the HTML directly. No markdown fence, no commentary, no preamble. Start with <!doctype html>. End with </html>.`;

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
      } catch {}
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
    const html = typeof body?.html === "string" ? body.html : "";
    const instruction = typeof body?.instruction === "string" ? body.instruction.trim() : "";

    if (!html || html.length < 200) {
      return new Response(JSON.stringify({ error: "HTML слишком короткий или пустой." }), { status: 400 });
    }
    if (!instruction || instruction.length < 5) {
      return new Response(JSON.stringify({ error: "Опиши что изменить (минимум 5 символов)." }), { status: 400 });
    }

    // Atomic deduct.
    const cost = REFINE_BLOCK_COST;
    const deducted = await db
      .update(users)
      .set({ impulses: sql`${users.impulses} - ${cost}` })
      .where(and(eq(users.id, userId), gte(users.impulses, cost)))
      .returning({ impulses: users.impulses });
    if (deducted.length === 0) {
      return new Response(JSON.stringify({ error: `Нужно ${cost} импульсов на балансе.` }), { status: 400 });
    }
    deductedUserId = userId;
    deductedCost = cost;

    // Strip data: URLs to placeholders before sending to Claude.
    // Saves token cost AND prevents Claude from corrupting/truncating
    // long base64 strings.
    const { stripped, map } = stripDataUrls(html);
    log.info("refine_started", { userId, instructionLen: instruction.length, originalSize: html.length, strippedSize: stripped.length, imageCount: map.size });

    const userMessage = `Instruction (apply with minimum diff):\n${instruction}\n\nHTML to edit:\n${stripped}`;

    const result = await callClaude(REFINE_SYSTEM_PROMPT, [{ type: "text", text: userMessage }]);
    const newStripped = result.html;

    const v = validateGeneratedHtml(newStripped, { product: "site", expectedCount: 0 });
    if (!v.ok) {
      await refund();
      log.warn("refine_validation_failed", { userId, reason: v.reason });
      return new Response(
        JSON.stringify({
          error: "Claude вернул некорректный HTML — попробуй ещё раз с уточнённой инструкцией. Импульсы возвращены.",
        }),
        { status: 502 },
      );
    }

    // Restore data: URLs from placeholders.
    const newHtml = restoreDataUrls(newStripped, map);
    log.info("refine_completed", { userId, finalSize: newHtml.length });

    return new Response(
      JSON.stringify({ ok: true, html: newHtml, cost }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    await refund();
    log.error("refine_failed", { userId: deductedUserId ?? undefined }, err);
    return new Response(
      JSON.stringify({ error: err?.message || "Ошибка применения правки" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
