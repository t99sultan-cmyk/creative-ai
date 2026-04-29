"use server";

import { auth } from "@clerk/nextjs/server";

/**
 * Takes a user-uploaded product photo (often a phone snap with bad
 * lighting, plain background, mid resolution) and runs it through
 * Nano Banana with a studio-photographer prompt. Returns a polished
 * 1024×1024 version where the same product looks like a commercial
 * product shot — clean lighting, sharp focus, subtle backdrop.
 *
 * Cost: ~$0.04 per call (Nano Banana / gemini-2.5-flash-image).
 * Latency: 8-20 sec. We keep it as a lazy step the user opts into
 * implicitly by uploading.
 *
 * The prompt explicitly forbids redesigning the product — only the
 * photography quality changes. If the model deviates anyway (rare),
 * the user can hit "↩ Оригинал" in the editor to revert.
 */

const POLISH_PROMPT = `You are a senior product photographer. Take the uploaded photo and recreate it as a STUDIO-GRADE commercial product shot:

CRITICAL — preserve the product:
- Same product, same shape, exact same brand/labels/text/colors/proportions
- Same camera angle (do NOT rotate or change viewpoint)
- Do NOT redesign, restyle, or change the product itself
- Treat it as a re-shoot of the existing product, not a new product

Improve the photography quality:
- Cinematic studio lighting: soft key light from upper-left, subtle rim light, gentle fill, clean cast shadow under the product
- Sharp focus, crisp edges, professional resolution
- Clean subtle backdrop: soft off-white to light grey gradient, NO clutter
- The product is centered, isolated, with breathing room
- No props, no decoration, no text overlays

Output: a single high-quality 1:1 product photo. The polished version should look indistinguishable from a paid commercial product shoot of the same item.`;

interface PolishResult {
  success: true;
  imageBase64: string;
  mimeType: string;
}

export async function polishProductPhoto(
  rawImage: string,
  rawMime: string = "image/png",
): Promise<PolishResult | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Не авторизован" };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { success: false, error: "GEMINI_API_KEY missing" };

  // Strip data: prefix if present.
  let mime = rawMime;
  let payload = rawImage;
  if (payload.startsWith("data:")) {
    mime = payload.split(";")[0].split(":")[1] || rawMime;
    payload = payload.split(",")[1] || "";
  }
  if (!payload) return { success: false, error: "Пустое изображение" };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: POLISH_PROMPT },
                { inlineData: { mimeType: mime, data: payload } },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ["IMAGE"],
            imageConfig: { aspectRatio: "1:1" },
          },
        }),
        signal: AbortSignal.timeout(60_000),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[polishProductPhoto] gemini error:", res.status, text.slice(0, 300));
      return { success: false, error: `Gemini ${res.status}` };
    }
    const data = await res.json();
    const part = data?.candidates?.[0]?.content?.parts?.find(
      (p: any) => p?.inlineData?.data,
    );
    if (!part?.inlineData?.data) {
      return { success: false, error: "Пустой ответ" };
    }
    return {
      success: true,
      imageBase64: part.inlineData.data,
      mimeType: part.inlineData.mimeType || "image/png",
    };
  } catch (err: any) {
    console.error("[polishProductPhoto] crashed:", err);
    return { success: false, error: err?.message || "polish failed" };
  }
}
