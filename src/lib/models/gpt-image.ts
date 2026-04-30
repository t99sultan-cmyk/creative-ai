/**
 * OpenAI gpt-image-2.
 *
 * Released April 2026, currently #1 on the LMArena image leaderboard
 * (Elo ~1333). Replaces our previous gpt-image-1 wiring. Same API
 * surface as v1 — only the `model` string changes. If OpenAI later
 * tweaks the param names or pricing, edit GPT_IMAGE_MODEL / size /
 * quality in this file.
 *
 * Two endpoints, picked at call time:
 *   • POST /v1/images/edits        — when a product photo is provided
 *     (multipart: image + prompt → edited / restyled output).
 *   • POST /v1/images/generations  — text-only.
 *
 * Sizes mapped from our internal Format:
 *   1:1  → 1024x1024
 *   9:16 → 1024x1536  (closest aspect; visually identical to true 9:16
 *                      for Story creatives at this resolution.)
 *
 * gpt-image-2 requires a verified OpenAI organization (same as v1).
 * If unverified, the API responds 403 with `must be verified to use
 * gpt-image-2` — surfaced verbatim so the user knows what to do.
 */

const GPT_IMAGE_MODEL = "gpt-image-2";

import { Buffer } from "node:buffer";
import type { Format } from "./shared";

export interface GptImageResult {
  imageBase64: string;
  mediaType: string;
  apiCostKzt: number;
}

const KZT_PER_USD = 480;

// gpt-image-2 "medium" quality pricing (Apr 2026): ~$0.04-0.05/image.
// "high" was 4× more expensive AND took >4 min per image; medium is
// ~30-60s and 4× cheaper, with marginal visual loss. Flat estimate
// per size — exact billing is whatever OpenAI charges per request.
const GPT_IMAGE_USD_BY_SIZE: Record<string, number> = {
  "1024x1024": 0.04,
  "1024x1536": 0.05,
  "1536x1024": 0.05,
};

interface GptImageInput {
  prompt: string;
  /** Raw base64 (no data: prefix) of an optional product photo. */
  productImageBase64?: string;
  /** Mime of the product image; defaults to image/png. */
  productImageMime?: string;
  /** Optional style references — data: URL or raw base64. */
  referenceImagesBase64?: string[];
  /** Region-specific instruction (currency, locale). Appended to prompt. */
  regionHint?: string;
  format: Format;
  /**
   * True when the user picked a scene preset ("в использовании",
   * "в интерьере", и т.д.). Suppresses the default "isolated studio
   * hero centerpiece" directive so the model actually renders a
   * person using / interacting with the product.
   */
  sceneActive?: boolean;
}

function sizeFor(format: Format): "1024x1024" | "1024x1536" | "1536x1024" {
  // GPT Image 2 has only three pixel sizes — pick the closest match
  // for each aspect ratio. 3:4 ≈ 1024x1366 → use 1024x1536 (slightly
  // narrower); 4:3 ≈ 1366x1024 → use 1536x1024 (slightly wider).
  switch (format) {
    case "1:1":
      return "1024x1024";
    case "9:16":
    case "3:4":
      return "1024x1536";
    case "16:9":
    case "4:3":
      return "1536x1024";
  }
}

function buildPrompt(prompt: string, format: Format, hasProduct: boolean, hasReference: boolean, sceneActive: boolean): string {
  const aspectInstruction =
    format === "9:16"
      ? "Output a 9:16 vertical Instagram Story creative."
      : "Output a 1:1 square Instagram feed creative.";
  return (
    `${prompt}\n\n${aspectInstruction}\n` +
    `THIS IS AN ADVERTISING CREATIVE FOR PAID SOCIAL (Instagram / TikTok / Kaspi). ` +
    `It is NOT a product catalog photo. It must SELL — drive clicks and purchases.\n\n` +
    `Mandatory components:\n` +
    `1) BOLD HEADLINE — large high-contrast Russian copy (2-6 words) at top or middle. Punchy hook.\n` +
    `2) Supporting sub-headline or price/discount callout in complementary size.\n` +
    `3) Visual hierarchy: headline → product → price/CTA. Enforce with scale, contrast, color blocking.\n` +
    `4) Strong CTA cue — button, badge, arrow, or pill ("Купить", "-30%", "Только сегодня") bottom area.\n` +
    `5) Sales-driven aesthetic — saturated brand colors, bold sans-serif headlines, designed-not-typed feel.\n\n` +
    `Text quality bar: every letter crisp and legible, no garbled fake-text, no overlap with product. ` +
    `Russian by default unless the brief overrides. ` +
    (hasProduct
      ? sceneActive
        ? `THE PROVIDED PRODUCT IMAGE is the reference for the product's exact ` +
          `shape, colors, materials, and labels — preserve those EXACTLY. But the ` +
          `COMPOSITION must follow the scene direction in the brief above (e.g. ` +
          `"in use by a person", "in real environment", "lifestyle moment"). ` +
          `DO NOT default to an isolated studio catalog shot — render the product ` +
          `WITHIN the described real-world context: hands holding/wearing/using it, ` +
          `or sitting naturally in the described environment. The scene direction ` +
          `wins over any "centerpiece" instinct. People, hands, props, and ambient ` +
          `lighting from the described setting are mandatory if the brief says so.`
        : `THE PROVIDED PRODUCT IMAGE IS THE HERO of this creative — ` +
          `place it as the visual centerpiece with cinematic studio lighting, ` +
          `premium reflections, and dramatic but tasteful composition. ` +
          `Preserve the product's exact shape, colors, and labels. Surrounding ` +
          `typography and accent shapes are supporting cast that amplifies the ` +
          `product without competing with it.`
      : `Compose a strong standalone advertising visual.`) +
    (hasReference
      ? ` Reference image(s) attached AFTER the product — match their visual STYLE ` +
        `(composition, palette, lighting, typography). Do NOT copy the subject; just adopt the look.`
      : "")
  );
}

export async function callGptImage(
  input: GptImageInput,
): Promise<GptImageResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

  const size = sizeFor(input.format);
  const refs = (input.referenceImagesBase64 ?? []).filter((s) => typeof s === "string" && s.length > 0);
  const prompt =
    buildPrompt(
      input.prompt,
      input.format,
      !!input.productImageBase64,
      refs.length > 0,
      !!input.sceneActive,
    ) + (input.regionHint ? `\n${input.regionHint}` : "");

  // Helper: data: URL or raw base64 → { mime, raw, ext }.
  function decodeImage(src: string, fallbackMime: string) {
    let mime = fallbackMime;
    let raw = src;
    if (raw.startsWith("data:")) {
      mime = raw.split(";")[0].split(":")[1] || fallbackMime;
      raw = raw.split(",")[1] || "";
    }
    const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
    return { mime, raw, ext };
  }

  let response: Response;
  if (input.productImageBase64 || refs.length > 0) {
    // /v1/images/edits — multipart. gpt-image-2 supports multiple
    // reference images via repeated `image[]` fields.
    const fd = new FormData();
    fd.set("model", GPT_IMAGE_MODEL);
    fd.set("prompt", prompt);
    fd.set("size", size);
    fd.set("quality", "medium");
    fd.set("n", "1");

    if (input.productImageBase64) {
      const { mime, raw, ext } = decodeImage(
        input.productImageBase64,
        input.productImageMime || "image/png",
      );
      const buf = Buffer.from(raw, "base64");
      fd.append(
        "image[]",
        new Blob([new Uint8Array(buf)], { type: mime }),
        `product.${ext}`,
      );
    }
    refs.forEach((ref, i) => {
      const { mime, raw, ext } = decodeImage(ref, "image/png");
      if (!raw) return;
      const buf = Buffer.from(raw, "base64");
      fd.append(
        "image[]",
        new Blob([new Uint8Array(buf)], { type: mime }),
        `ref-${i}.${ext}`,
      );
    });

    response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: fd,
      // gpt-image-2 quality "high" can take 90-180 sec per image. We
      // bumped from 120s after seeing repeat AbortSignal timeouts at
      // exactly the 120s mark. Route's maxDuration is 300s so 240s
      // here leaves headroom for the rest of the handler.
      signal: AbortSignal.timeout(240_000),
    });
  } else {
    response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GPT_IMAGE_MODEL,
        prompt,
        size,
        quality: "medium",
        n: 1,
      }),
      signal: AbortSignal.timeout(240_000),
    });
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `GPT-Image API error (${response.status}): ${text.slice(0, 500)}`,
    );
  }

  const data = await response.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error(
      `GPT-Image returned no image. Raw: ${JSON.stringify(data).slice(0, 400)}`,
    );
  }

  const apiCostKzt = (GPT_IMAGE_USD_BY_SIZE[size] ?? 0.05) * KZT_PER_USD;
  console.log(
    `[GptImage] generated 1 image (${input.format}, ${size}) ≈ ${apiCostKzt.toFixed(2)} KZT`,
  );
  return { imageBase64: b64, mediaType: "image/png", apiCostKzt };
}
