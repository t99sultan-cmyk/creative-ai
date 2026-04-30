"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { creatives, users } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";

/**
 * Refine an existing creative image with a free-form edit instruction.
 * Sends the source image + the user's edit prompt to Gemini 3 Pro
 * Image (Nano Banana Pro), which is good at "preserve everything but
 * change the requested thing" edits.
 *
 * Use cases:
 *   • "поменяй текст на 'Скидка 50%'"
 *   • "сделай фон тёмно-синим"
 *   • "убери блюр на заднем плане"
 *   • "добавь призыв к действию внизу"
 *
 * Cost: 2 impulses per refinement. Refunded automatically on failure.
 * The original creative row is mutated in-place — its imageUrl is
 * replaced with the refined version. Pair / model / format stay
 * the same so analytics and "best" selection keep working.
 */

const REFINE_COST = 2;
const GEMINI_MODEL = "gemini-3-pro-image-preview";

export async function refineImage(
  creativeId: string,
  editInstruction: string,
): Promise<{ success: true; imageUrl: string } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Не авторизован" };

  const cleaned = editInstruction.trim();
  if (!cleaned) return { success: false, error: "Опиши что изменить" };
  if (cleaned.length > 240) {
    return { success: false, error: "Слишком длинная правка (максимум 240 симв.)" };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { success: false, error: "GEMINI_API_KEY missing" };

  // Fetch source creative + verify ownership.
  const rows = await db
    .select()
    .from(creatives)
    .where(and(eq(creatives.id, creativeId), eq(creatives.userId, userId)))
    .limit(1);
  const source = rows[0];
  if (!source) return { success: false, error: "Креатив не найден" };
  if (!source.imageUrl) {
    return { success: false, error: "У этого креатива нет картинки для редактирования" };
  }

  // Atomic deduct.
  const cost = REFINE_COST;
  const deducted = await db
    .update(users)
    .set({ impulses: sql`${users.impulses} - ${cost}` })
    .where(and(eq(users.id, userId), gte(users.impulses, cost)))
    .returning({ impulses: users.impulses });
  if (deducted.length === 0) {
    return { success: false, error: `Нужно ${cost} импульсов на балансе.` };
  }

  let mime = "image/png";
  let payload = source.imageUrl;
  if (payload.startsWith("data:")) {
    mime = payload.split(";")[0].split(":")[1] || mime;
    payload = payload.split(",")[1] || "";
  }

  const aspect = source.format === "1:1" ? "1:1" : "9:16";
  const REFINE_PROMPT =
    `Edit the provided image based on this user instruction:\n\n` +
    `"${cleaned}"\n\n` +
    `STRICT RULES — preserve the rest of the image:\n` +
    `- Make ONLY the change the user asked for.\n` +
    `- Everything else stays IDENTICAL: composition, layout, all other text, ` +
    `all other elements, color palette of unchanged areas, lighting, mood.\n` +
    `- The output must look like the same image, just with the requested edit applied.\n` +
    `- Aspect ratio: ${aspect === "1:1" ? "1:1 square" : "9:16 vertical"}.\n` +
    `- Treat all text in the image as crisp and legible. Russian text by default.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: REFINE_PROMPT },
                { inlineData: { mimeType: mime, data: payload } },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["IMAGE"],
            imageConfig: { aspectRatio: aspect },
          },
        }),
        signal: AbortSignal.timeout(90_000),
      },
    );

    if (!res.ok) {
      // Refund and bail.
      await db
        .update(users)
        .set({ impulses: sql`${users.impulses} + ${cost}` })
        .where(eq(users.id, userId));
      const text = await res.text().catch(() => "");
      console.error("[refineImage] gemini error:", res.status, text.slice(0, 300));
      return {
        success: false,
        error:
          res.status === 503 || res.status === 429
            ? "Серверы Gemini перегружены, попробуй ещё раз через минуту"
            : `Gemini вернул ${res.status}`,
      };
    }

    const data = await res.json();
    const part = data?.candidates?.[0]?.content?.parts?.find(
      (p: any) => p?.inlineData?.data,
    );
    if (!part?.inlineData?.data) {
      await db
        .update(users)
        .set({ impulses: sql`${users.impulses} + ${cost}` })
        .where(eq(users.id, userId));
      return { success: false, error: "Пустой ответ от Gemini" };
    }

    const newImageBase64 = part.inlineData.data;
    const newMime = part.inlineData.mimeType || "image/png";
    const newDataUrl = `data:${newMime};base64,${newImageBase64}`;

    // Mutate the row in place — keep pairId, model, format, etc.
    await db
      .update(creatives)
      .set({ imageUrl: newDataUrl })
      .where(and(eq(creatives.id, creativeId), eq(creatives.userId, userId)));

    return { success: true, imageUrl: newDataUrl };
  } catch (err: any) {
    await db
      .update(users)
      .set({ impulses: sql`${users.impulses} + ${cost}` })
      .where(eq(users.id, userId));
    console.error("[refineImage] crashed:", err);
    return { success: false, error: err?.message || "refine failed" };
  }
}
