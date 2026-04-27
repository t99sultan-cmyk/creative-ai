/**
 * Per-model HTML generation helpers — minimal version.
 *
 * Just two functions: callClaude and callGemini. Each takes a system
 * prompt + content blocks (text + images), hits the model, returns
 * { html, apiCostKzt } or throws.
 *
 * No tool_use, no agent loops, no canvas mode. The /api/generate
 * route calls callClaude and callGemini in parallel via
 * Promise.allSettled and returns both outputs to the client.
 */

export type ModelChoice = "claude" | "gemini";

export type AnthropicContentBlock =
  | { type: "text"; text: string; cache_control?: { type: "ephemeral"; ttl?: string } }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

export interface CallResult {
  html: string;
  apiCostKzt: number;
}

const KZT_PER_USD = 480;

/**
 * Anthropic Claude Opus 4.7. Pricing: $15/M input, $75/M output.
 * Uses extended-cache-ttl beta header so the system block can be
 * cached for 1h between calls (high reuse since system prompt rarely
 * changes — major cost saving on repeat generations).
 */
export async function callClaude(
  systemPrompt: string,
  content: AnthropicContentBlock[],
): Promise<CallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is missing");

  let response: Response | null = null;
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "extended-cache-ttl-2025-04-11",
      },
      body: JSON.stringify({
        model: "claude-opus-4-7",
        system: [
          {
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral", ttl: "1h" },
          },
        ],
        max_tokens: 8192,
        messages: [{ role: "user", content }],
      }),
    });

    if (response.status === 429) {
      console.warn(`[Claude] 429 — retry ${attempt + 1}/3 in 15s`);
      await new Promise((r) => setTimeout(r, 15000));
      continue;
    }
    if (!response.ok) {
      lastError = await response.text();
      throw new Error(`Claude API error: ${lastError}`);
    }
    break;
  }
  if (!response || !response.ok) {
    throw new Error(`Claude API error (max retries): ${lastError}`);
  }

  const result = await response.json();
  const html = result.content?.[0]?.text ?? "";
  const inTokens = result.usage?.input_tokens ?? 0;
  const outTokens = result.usage?.output_tokens ?? 0;
  const usd = (inTokens / 1_000_000) * 15 + (outTokens / 1_000_000) * 75;
  const apiCostKzt = usd * KZT_PER_USD;
  console.log(
    `[Claude Opus 4.7] ${inTokens} in / ${outTokens} out = $${usd.toFixed(4)} (~${apiCostKzt.toFixed(2)} KZT)`,
  );
  return { html, apiCostKzt };
}

/**
 * Google Gemini 3.1 Pro. Pricing: $1.25/M input, $5/M output.
 * Same retry/backoff shape as Claude; converts Anthropic-style content
 * blocks into Gemini parts at call time.
 */
export async function callGemini(
  systemPrompt: string,
  content: AnthropicContentBlock[],
): Promise<CallResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

  type GeminiPart =
    | { text: string }
    | { inlineData: { mimeType: string; data: string } };
  const parts: GeminiPart[] = [];
  for (const item of content) {
    if (item.type === "text") {
      parts.push({ text: item.text });
    } else if (item.type === "image" && item.source?.data) {
      parts.push({
        inlineData: { mimeType: item.source.media_type, data: item.source.data },
      });
    }
  }

  let response: Response | null = null;
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts }],
          generationConfig: { maxOutputTokens: 8192, temperature: 0.7 },
        }),
      },
    );
    if (response.status === 429) {
      console.warn(`[Gemini] 429 — retry ${attempt + 1}/3 in 15s`);
      await new Promise((r) => setTimeout(r, 15000));
      continue;
    }
    if (!response.ok) {
      lastError = await response.text();
      throw new Error(`Gemini API error: ${lastError}`);
    }
    break;
  }
  if (!response || !response.ok) {
    throw new Error(`Gemini API error (max retries): ${lastError}`);
  }

  const data = await response.json();
  const html = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const inTokens = data?.usageMetadata?.promptTokenCount ?? 0;
  const outTokens = data?.usageMetadata?.candidatesTokenCount ?? 0;
  const usd = (inTokens / 1_000_000) * 1.25 + (outTokens / 1_000_000) * 5;
  const apiCostKzt = usd * KZT_PER_USD;
  console.log(
    `[Gemini 3.1 Pro] ${inTokens} in / ${outTokens} out = $${usd.toFixed(4)} (~${apiCostKzt.toFixed(2)} KZT)`,
  );
  return { html, apiCostKzt };
}

/** Pick the helper by model name. */
export function callModel(
  model: ModelChoice,
  systemPrompt: string,
  content: AnthropicContentBlock[],
): Promise<CallResult> {
  return model === "gemini"
    ? callGemini(systemPrompt, content)
    : callClaude(systemPrompt, content);
}

// ============================================================
// Imagen 4 — direct PNG image generation via Gemini API.
// Used as the 3rd "card" alongside Claude/Gemini HTML outputs.
// Returns a base64-encoded PNG (no Cloud Storage round-trip).
// ============================================================

export interface ImagenResult {
  /** PNG bytes as base64 (no data: prefix). */
  imageBase64: string;
  /** MIME type, typically "image/png". */
  mediaType: string;
  apiCostKzt: number;
}

/**
 * Call Imagen 4 via Gemini API. Reuses the existing GEMINI_API_KEY.
 * Generates a single image at the requested aspect ratio.
 *
 * Pricing (Apr 2026 public Google AI rates): $0.04 per image (1024×1024
 * or aspect-equivalent). Same KZT conversion as text models.
 */
export async function callImagen(
  prompt: string,
  format: "9:16" | "1:1",
): Promise<ImagenResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

  // Imagen aspect ratio strings differ from our internal format.
  // 9:16 → "9:16", 1:1 → "1:1".
  const aspectRatio = format;

  let response: Response | null = null;
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio,
            // Allow people in image (otherwise Imagen often blocks
            // anything portrait-related, which hurts ad creatives).
            personGeneration: "allow_adult",
          },
        }),
      },
    );
    if (response.status === 429) {
      console.warn(`[Imagen] 429 — retry ${attempt + 1}/3 in 15s`);
      await new Promise((r) => setTimeout(r, 15000));
      continue;
    }
    if (!response.ok) {
      lastError = await response.text();
      throw new Error(`Imagen API error: ${lastError}`);
    }
    break;
  }
  if (!response || !response.ok) {
    throw new Error(`Imagen API error (max retries): ${lastError}`);
  }

  const data = await response.json();
  // Response shape: { predictions: [{ bytesBase64Encoded: "...", mimeType: "image/png" }] }
  const pred = data?.predictions?.[0];
  const imageBase64 = pred?.bytesBase64Encoded;
  const mediaType = pred?.mimeType || "image/png";
  if (!imageBase64) {
    throw new Error(`Imagen returned no image: ${JSON.stringify(data).slice(0, 300)}`);
  }
  // Flat per-image price.
  const apiCostKzt = 0.04 * KZT_PER_USD;
  console.log(`[Imagen 4] generated 1 image (${format}) ≈ ${apiCostKzt.toFixed(2)} KZT`);
  return { imageBase64, mediaType, apiCostKzt };
}

/** Strip ```html``` markdown fences if the model wrapped its output. */
export function unwrapHtml(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/```(?:html)?\s*([\s\S]*?)```/);
  return match ? match[1] : trimmed;
}

/** Replace `PRODUCT_IMG_N` and remix-preserved placeholders with real
 *  base64 data. When productImages is empty, strip orphan
 *  PRODUCT_IMG_* references so they don't render as broken boxes. */
export function injectPlaceholders(
  html: string,
  productImages: string[] | undefined,
  preservedRemixImages: string[] | undefined,
): string {
  let out = html;
  const hasProducts = Array.isArray(productImages) && productImages.length > 0;

  if (hasProducts) {
    productImages!.forEach((b64, i) => {
      out = out.replace(new RegExp(`PRODUCT_IMG_${i}`, "g"), b64);
    });
  } else {
    out = out.replace(/<img\b[^>]*?\bsrc\s*=\s*["']PRODUCT_IMG_\d+["'][^>]*?\/?>/gi, "");
    out = out.replace(/url\(\s*["']?PRODUCT_IMG_\d+["']?\s*\)/gi, "none");
    out = out.replace(/PRODUCT_IMG_\d+/g, "");
  }

  if (preservedRemixImages && preservedRemixImages.length > 0) {
    preservedRemixImages.forEach((b64, i) => {
      out = out.replace(new RegExp(`REMIX_PRESERVED_IMG_${i}`, "g"), b64);
    });
  }
  return out;
}
