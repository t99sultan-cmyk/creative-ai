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

{"product":"<2-6 Russian words: what's in the photo>","category":"<one of: clothing, accessories, food, cosmetics, gadgets, home, other>","subject":"<the product/service to advertise — same noun as product, ready for the brief>","benefit":"<one-line hook/main selling point in Russian>","audience":"<target audience in Russian — 1 short phrase>","style":"<visual style and tone in Russian — 2-4 keywords>","brief":"<DETAILED structured Russian TZ, 400-700 chars — see brief format below>"}

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

"brief" — a DETAILED, SELLING TZ that goes straight into an AI image generator. 500-900 characters. Six sections separated by " · ", labels in ALL CAPS:
ЗАГОЛОВОК · ПОДЗАГОЛОВОК · CTA · ВИЗУАЛ · КОМПОЗИЦИЯ · ПРОДУКТ

Brief hard rules:
- 500-900 chars total. Anything shorter than 500 is a failure.
- Russian for all section content
- Headlines, sub-copy, CTA text MUST be in « » quotes — these are the LITERAL strings the AI renders pixel-by-pixel. Write the final text, never a placeholder.
- ВИЗУАЛ, КОМПОЗИЦИЯ, ПРОДУКТ: 2-3 sentences each. Concrete details — name colors with hex if obvious from the photo (e.g. «чёрный графит #1A1A1A»), name angles, name positions in the frame. Forbidden words: "красивый", "приятный", "стильный", "качественный".

SELLING quality (the whole point):
- ЗАГОЛОВОК is a HOOK, not a description. Hits emotion (страх упустить, статус, экономия, удовольствие) or a benefit. Good: «Звук, который окутывает», «Минус 30 минут утром». Bad: «Купите наушники», «Скидка на товар».
- ПОДЗАГОЛОВОК always carries a number (price/%/срок) OR urgency («осталось 12», «до пятницы») OR social proof («2400+ заказов», «выбор Kaspi»). Never vague.
- CTA — verb in повелительном: «Заказать», «Забрать», «Попробовать», «Получить». Not «Узнать больше».
- Tone bleeds through word choice. Premium → лаконично, английские слова. Молодёжный → сленг. Семейный → тёплое, про дом/детей. Женский → эмоция, текстуры. Мужской → результат, цифры.
- If "benefit" contains a number, that number MUST appear verbatim in ПОДЗАГОЛОВОК.
- ПРОДУКТ section MUST reflect what you actually SEE in the photo (cвет, материал, упаковка, реальная среда вокруг) — never generic guesses. If photo shows a cosmetic on white background, write «крем в белой стеклянной банке с золотой крышкой, центр кадра, мягкий рассеянный свет сверху, тёплая тень снизу».

If the photo is sparse (just a product on white) — INVENT a plausible scene/lifestyle context for the COMPOSITION and a price tier reasonable for that product type and Russian/Kazakh market.

EXAMPLE (study the depth and follow this density):
ЗАГОЛОВОК: «Звук без проводов» · ПОДЗАГОЛОВОК: «−30% до 5 мая · 25 990 ₸ вместо 36 990 ₸» · CTA: «Заказать» · ВИЗУАЛ: премиум минимализм, тёмный режим, палитра — насыщенный графит #1A1A1A, матовое золото #C9A961, кремовый акцент. Атмосфера дорогого магазина гаджетов, мягкий свет. · КОМПОЗИЦИЯ: AirPods в открытом кейсе по центру нижней трети, занимают 40% высоты. Заголовок крупным жирным шрифтом сверху на 2 строки, выровнен по центру. Подзаголовок с ценой — плашка слева внизу под товаром. CTA-кнопка золотая, скруглённая, в правом нижнем углу. · ПРОДУКТ: AirPods под углом 30° сверху, кейс полуоткрыт, виден один наушник внутри. Студийный свет 45° слева, мягкая тень снизу, бликующая фаска кейса. Фон — тёмный градиент от графита к чёрному, лёгкое световое пятно за товаром.

CRITICAL: the JSON response is one object. Start with { end with }. brief field is a single string with " · " separators, NOT a nested object.`;

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

  // Three Gemini attempts before giving up:
  //   1-2. gemini-3-pro-preview (primary, best quality)
  //   3.   gemini-3.1-pro-preview (fallback when 3-pro is overloaded)
  // Photo upload is the primary signal users see — if it silently fails
  // they think the product wasn't recognised at all. So we burn an extra
  // attempt rather than fail fast.
  const MODELS = ["gemini-3-pro-preview", "gemini-3.1-pro-preview"];
  const BACKOFFS_MS = [1000, 2500, 4500];
  let lastError = "";

  for (let attempt = 0; attempt < 3; attempt++) {
    const model = attempt < 2 ? MODELS[0] : MODELS[1];
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
                  { text: "Проанализируй это фото и верни JSON со всеми семью полями. Brief — детальный, в указанном формате с шестью секциями." },
                  { inlineData: { mimeType: mime, data: payload } },
                ],
              },
            ],
            generationConfig: {
              maxOutputTokens: 2048,
              temperature: 0.7,
            },
          }),
          signal: AbortSignal.timeout(25_000),
        },
      );

      if (res.status === 503 || res.status === 429 || res.status >= 500) {
        const text = await res.text().catch(() => "");
        lastError = `Gemini ${res.status} (${model})`;
        console.warn(`[analyzeProductForBrief] ${lastError}:`, text.slice(0, 200));
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, BACKOFFS_MS[attempt]));
          continue;
        }
        return { success: false, error: "Серверы Gemini перегружены, попробуй ещё раз через минуту" };
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
        const brief = trim(parsed.brief, 1000);
        if (product || brief || subject) {
          return { success: true, product, category, subject, benefit, audience, style, brief };
        }
      }
      console.warn(
        "[analyzeProductForBrief] could not extract fields from:",
        raw.slice(0, 400),
      );
      lastError = "Не удалось разобрать ответ ИИ";
      // Try again with the fallback model — sometimes 3-pro returns
      // malformed JSON when overloaded, while 3.1-pro behaves.
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, BACKOFFS_MS[attempt]));
        continue;
      }
      return { success: false, error: lastError };
    } catch (err: any) {
      lastError = err?.message || "fetch failed";
      console.warn("[analyzeProductForBrief] attempt failed:", lastError);
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, BACKOFFS_MS[attempt]));
        continue;
      }
    }
  }

  return { success: false, error: lastError || "Не удалось распознать продукт" };
}
