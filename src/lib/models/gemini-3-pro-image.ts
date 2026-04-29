/**
 * Google "Nano Banana Pro" — Gemini 3 Pro Image.
 *
 * Pro tier of Google's image generation, sibling to Nano Banana
 * (gemini-2.5-flash-image). Higher fidelity, native 4K output, better
 * prompt adherence. Same GEMINI_API_KEY as the rest of Google.
 *
 * Same API surface as Nano Banana — only the model ID changes. If
 * Google later renames it, edit GEMINI_3_PRO_IMAGE_MODEL below.
 *
 * Pricing: ~$0.24 per 4K image (Apr 2026).
 */

import type { Format } from "./shared";

// Confirmed via /v1beta/models?key=$GEMINI_API_KEY listing — Google
// uses "gemini-3-pro-image-preview" (no ".0", no ".1"). Sibling models
// in the family: gemini-3-pro-preview (text), gemini-3.1-flash-image-
// preview ("Nano Banana 2"), gemini-3.1-pro-preview (Gemini 3.1 text).
const GEMINI_3_PRO_IMAGE_MODEL = "gemini-3-pro-image-preview";

export interface Gemini3ProImageResult {
  imageBase64: string;
  mediaType: string;
  apiCostKzt: number;
}

const KZT_PER_USD = 480;
const NANO_BANANA_PRO_USD_PER_IMAGE = 0.24;

interface Gemini3ProImageInput {
  prompt: string;
  productImageBase64?: string;
  productImageMime?: string;
  /** Optional style references — each is a data: URL or raw base64. */
  referenceImagesBase64?: string[];
  format: Format;
}

export async function callGemini3ProImage(
  input: Gemini3ProImageInput,
): Promise<Gemini3ProImageResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

  const aspectInstruction =
    input.format === "9:16"
      ? "Output a 9:16 vertical Instagram Story creative (1080x1920 or higher)."
      : "Output a 1:1 square Instagram feed creative (1080x1080 or higher).";

  const fullPrompt =
    `${input.prompt}\n\n${aspectInstruction}\n` +
    `Style: high-end advertising creative. Bold composition, modern typography, sales-driven layout. ` +
    `If text appears, write it in Russian unless the brief asks otherwise — render it crisp and legible, ` +
    `no garbled letters. ` +
    (input.productImageBase64
      ? `THE PROVIDED PRODUCT IMAGE IS THE HERO of this creative — ` +
        `place it as the visual centerpiece with cinematic studio lighting, ` +
        `premium reflections, and dramatic but tasteful composition. ` +
        `Preserve the product's exact shape, colors, and labels. Treat surrounding ` +
        `elements (typography, accent shapes, gradient backgrounds) as supporting ` +
        `cast that amplifies the product without competing with it.`
      : `Compose a strong standalone advertising visual.`);

  type Part =
    | { text: string }
    | { inlineData: { mimeType: string; data: string } };

  // Strip a data: prefix off a base64 string and return { mime, raw }.
  function splitDataUrl(s: string, fallbackMime: string): { mime: string; data: string } {
    if (s.startsWith("data:")) {
      const mime = s.split(";")[0].split(":")[1] || fallbackMime;
      const data = s.split(",")[1] || "";
      return { mime, data };
    }
    return { mime: fallbackMime, data: s };
  }

  const parts: Part[] = [{ text: fullPrompt }];
  if (input.productImageBase64) {
    const { mime, data } = splitDataUrl(input.productImageBase64, input.productImageMime || "image/png");
    parts.push({ inlineData: { mimeType: mime, data } });
  }
  if (input.referenceImagesBase64?.length) {
    parts.push({
      text:
        "REFERENCE IMAGE(S) below — match this visual STYLE: composition, " +
        "color palette, lighting mood, typography style. Don't copy the " +
        "subject — just adopt the look. The product (if provided above) " +
        "stays the hero, only its presentation should follow these refs.",
    });
    for (const ref of input.referenceImagesBase64) {
      const { mime, data } = splitDataUrl(ref, "image/png");
      if (data) parts.push({ inlineData: { mimeType: mime, data } });
    }
  }

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: input.format },
    },
  };

  let response: Response | null = null;
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_3_PRO_IMAGE_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(90_000),
      },
    );
    if (response.status === 429 || response.status >= 500) {
      lastError = await response.text().catch(() => "");
      console.warn(
        `[Gemini3ProImage] ${response.status} — retry ${attempt + 1}/2 in 5s`,
      );
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    if (!response.ok) {
      lastError = await response.text().catch(() => "");
      throw new Error(
        `Gemini 3 Pro Image API error (${response.status}): ${lastError.slice(0, 400)}`,
      );
    }
    break;
  }
  if (!response || !response.ok) {
    throw new Error(
      `Gemini 3 Pro Image API error (max retries): ${lastError.slice(0, 400)}`,
    );
  }

  const data = await response.json();
  const candidateParts = data?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = candidateParts.find((p: any) => p?.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    throw new Error(
      `Gemini 3 Pro Image returned no image. Raw: ${JSON.stringify(data).slice(0, 400)}`,
    );
  }

  const apiCostKzt = NANO_BANANA_PRO_USD_PER_IMAGE * KZT_PER_USD;
  console.log(
    `[Gemini3ProImage] generated 1 image (${input.format}) ≈ ${apiCostKzt.toFixed(2)} KZT`,
  );
  return {
    imageBase64: imagePart.inlineData.data,
    mediaType: imagePart.inlineData.mimeType || "image/png",
    apiCostKzt,
  };
}
