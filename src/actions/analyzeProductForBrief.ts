"use server";

import { auth } from "@clerk/nextjs/server";

/**
 * Sends a product photo to Gemini 3 Pro Preview (multimodal) and asks
 * for two things back as JSON:
 *   1. `product` — what's in the photo, in 2-6 Russian words
 *      (e.g. "кроссовки Nike Air Max", "кружка с лого Starbucks").
 *   2. `brief`   — a 60-200 char Russian advertising brief tailored
 *      to that product, ready to drop into the prompt textarea.
 *
 * Used right after the user uploads a product photo: we display
 * "Мы рекламируем: {product}" to confirm understanding, and pre-fill
 * the TZ textarea with the brief. User can edit before generating.
 *
 * Cost: ~$0.005 per call. Free for the user (no impulse charge).
 * Latency: 3-8 sec (fast — only one short text response).
 */

const SYSTEM_PROMPT = `You are a senior advertising creative director.

You receive a product photo. Output ONE JSON object with exactly these 7 string fields and nothing else — no markdown, no code fences, no commentary, no preamble:

{"product":"<2-6 Russian words: what's in the photo>","category":"<one of: clothing, accessories, food, cosmetics, gadgets, home, other>","subject":"<the product/service to advertise — same noun as product, ready for the brief>","benefit":"<one-line hook/main selling point in Russian>","audience":"<target audience in Russian — 1 short phrase>","style":"<visual style and tone in Russian — 2-4 keywords>","brief":"<60-200 Russian chars — the full ad brief assembled from the above fields>"}

Category guide:
- "clothing": одежда, обувь, головные уборы (футболки, кроссовки, шапки)
- "accessories": часы, сумки, кошельки, очки, ремни, украшения
- "food": еда, напитки, кофе, выпечка, продукты, ингредиенты
- "cosmetics": косметика, парфюм, крем, помада, средства ухода, шампуни
- "gadgets": электроника, наушники, смартфоны, ноутбуки, гаджеты
- "home": мебель, предметы интерьера, лампы, посуда, декор
- "other": всё что не подходит ни под одну из выше

Field rules:
- "product": 2-6 Russian words. Concrete + specific. Brand if visible. Type + key visual cue. Bad: "Наушники". Good: "Беспроводные наушники Apple AirPods Pro белые".
- "subject": what we're advertising — usually the same noun as product, can be more campaign-flavored.
- "benefit": one believable selling hook with NUMBERS or specifics if possible. Skip clichés. Examples: "−30% до конца недели", "Беспроводные, 24 часа музыки", "Бесплатная доставка по Алматы". 30-80 chars.
- "audience": 1 short phrase describing who'd buy this. e.g. "Молодёжь 18-26, любит спорт".
- "style": 2-4 visual-style keywords. e.g. "Минимализм, премиум, мягкий свет".
- "brief": 80-200 chars Russian. THIS IS A BRIEF FOR A PAID-SOCIAL AD CREATIVE — not a product catalog shot. It should explicitly mention: a BOLD HEADLINE the AI should render on the creative (2-6 words punchy hook), a price/discount/promo callout if relevant, and a CTA hint ("Купить", "Узнать", "Заказать"). Designer's TZ style, not marketing prose.

CRITICAL: response is the raw JSON object only. Start with { end with }.`;

interface AnalyzeResult {
  success: true;
  product: string;
  /** Detected product category — drives the editor's scene presets. */
  category: string;
  subject: string;
  benefit: string;
  audience: string;
  style: string;
  brief: string;
}

/**
 * Extract { product, brief } from a Gemini response that's *supposed*
 * to be JSON but might have markdown fences, trailing comments, or
 * extra prose. Tries hardest-first: clean parse → trimmed-to-braces
 * parse → regex fallback. Returns null only if nothing recognizable
 * is found.
 */
type AnalyzeFields = {
  product?: string;
  category?: string;
  subject?: string;
  benefit?: string;
  audience?: string;
  style?: string;
  brief?: string;
};

function extractJsonish(raw: string): AnalyzeFields | null {
  const stripped = raw.replace(/^```(?:json)?\s*|\s*```$/gm, "").trim();
  // 1) Direct JSON parse.
  try {
    const obj = JSON.parse(stripped);
    if (typeof obj === "object" && obj !== null) return obj;
  } catch {}
  // 2) Find outermost braces and parse the slice.
  const first = stripped.indexOf("{");
  const last = stripped.lastIndexOf("}");
  if (first >= 0 && last > first) {
    const slice = stripped.slice(first, last + 1);
    try {
      const obj = JSON.parse(slice);
      if (typeof obj === "object" && obj !== null) return obj;
    } catch {}
  }
  // 3) Regex fallback per field.
  const grab = (key: string) => {
    const m = stripped.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, "i"));
    return m?.[1]?.trim();
  };
  const result: AnalyzeFields = {
    product: grab("product"),
    category: grab("category"),
    subject: grab("subject"),
    benefit: grab("benefit"),
    audience: grab("audience"),
    style: grab("style"),
    brief: grab("brief"),
  };
  if (Object.values(result).some((v) => v)) return result;
  return null;
}

export async function analyzeProductForBrief(
  imageDataUrl: string,
): Promise<AnalyzeResult | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Не авторизован" };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { success: false, error: "GEMINI_API_KEY missing" };

  // Strip data: prefix.
  let mime = "image/png";
  let payload = imageDataUrl;
  if (payload.startsWith("data:")) {
    mime = payload.split(";")[0].split(":")[1] || mime;
    payload = payload.split(",")[1] || "";
  }
  if (!payload) return { success: false, error: "Пустое изображение" };

  // Try gemini-3-pro-preview first; on transient 5xx fall back to
  // gemini-3.1-pro-preview. Single retry to keep latency reasonable.
  const MODELS = ["gemini-3-pro-preview", "gemini-3.1-pro-preview"];
  let lastError = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const model = MODELS[attempt];
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [
              {
                role: "user",
                parts: [
                  { text: "Проанализируй это фото и верни JSON { product, brief }." },
                  { inlineData: { mimeType: mime, data: payload } },
                ],
              },
            ],
            generationConfig: {
              maxOutputTokens: 512,
              temperature: 0.5,
            },
          }),
          signal: AbortSignal.timeout(20_000),
        },
      );

      if (res.status === 503 || res.status === 429 || res.status >= 500) {
        const text = await res.text().catch(() => "");
        lastError = `Gemini ${res.status} (${model})`;
        console.warn(`[analyzeProductForBrief] ${lastError}:`, text.slice(0, 200));
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        return { success: false, error: "Серверы Gemini перегружены" };
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("[analyzeProductForBrief] gemini error:", res.status, text.slice(0, 300));
        return { success: false, error: `Gemini вернул ${res.status}` };
      }

      const data = await res.json();
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const parsed = extractJsonish(raw);
      if (parsed) {
        const trim = (s: unknown, max: number) => String(s || "").trim().slice(0, max);
        const product = trim(parsed.product, 80);
        const category = trim(parsed.category, 24).toLowerCase();
        const subject = trim(parsed.subject || parsed.product, 80);
        const benefit = trim(parsed.benefit, 120);
        const audience = trim(parsed.audience, 120);
        const style = trim(parsed.style, 120);
        const brief = trim(parsed.brief, 240);
        if (product || brief || subject) {
          return { success: true, product, category, subject, benefit, audience, style, brief };
        }
      }
      console.warn(
        "[analyzeProductForBrief] could not extract fields from:",
        raw.slice(0, 400),
      );
      return { success: false, error: "Не удалось разобрать ответ ИИ" };
    } catch (err: any) {
      lastError = err?.message || "fetch failed";
      console.warn("[analyzeProductForBrief] attempt failed:", lastError);
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
    }
  }

  return { success: false, error: lastError || "Не удалось распознать продукт" };
}
