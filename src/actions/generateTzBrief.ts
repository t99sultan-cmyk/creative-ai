"use server";

import { auth } from "@clerk/nextjs/server";

/**
 * Builds a detailed structured Russian advertising brief from the
 * 4-question helper in the editor + (optionally) the uploaded product
 * photo and the chosen scene preset. When a photo is present we use
 * a multimodal Gemini call so the brief is grounded in what's actually
 * visible — colors, materials, packaging, environment — instead of
 * being a text-only guess.
 *
 * The output is a multi-section TZ that drops straight into the prompt
 * textarea and gets sent to image-gen models (Gemini 3 Pro Image /
 * GPT Image 2). Modern image-gen models handle structured prompts
 * well, so we explicitly spell out: exact headline text, subheadline /
 * price callout, CTA copy, palette, layout, product treatment.
 */

const SYSTEM_PROMPT = `You are a senior art director writing a DETAILED, SELLING brief for a paid-social ad creative (Instagram, TikTok, Kaspi feed). Your output goes straight into an AI image generator (Gemini 3 Pro Image / GPT Image 2) — they execute every word.

OUTPUT RULES (non-negotiable):
- Output is ONE Russian brief, 500-900 characters total. Shorter than 500 = failure.
- Six sections in this exact order, separated by " · ", labels in ALL CAPS:
  ЗАГОЛОВОК · ПОДЗАГОЛОВОК · CTA · ВИЗУАЛ · КОМПОЗИЦИЯ · ПРОДУКТ
- ЗАГОЛОВОК, ПОДЗАГОЛОВОК, CTA: every text element wrapped in « » quotes — these are the LITERAL strings the image-gen renders pixel-by-pixel. Write the actual final text, never a placeholder.
- ВИЗУАЛ, КОМПОЗИЦИЯ, ПРОДУКТ: 2-3 sentences each. Concrete details — name colors, name angles, name positions in the frame. No "красивый", "приятный", "стильный" — those words are forbidden.

PHOTO INPUT (if provided):
- The user uploaded a real product/subject photo. The ПРОДУКТ section MUST describe what you actually SEE: real colors, real materials, real packaging, real surroundings. Use hex codes when colors are obvious (e.g. «глубокий синий #1E3A5F»).
- If the photo shows a person — describe them factually (возраст, пол, одежда, поза) and write the brief around them as the hero of the creative.
- The photo is the ground truth — never contradict what's visible. If the photo shows a black bottle, don't write white in ВИЗУАЛ.

SCENE HINT (if provided):
- The user picked a scene preset for "как показать товар" (e.g. "на модели", "flat-lay", "в руках", "на столе с пропсами"). Bake this into КОМПОЗИЦИЯ and ПРОДУКТ.

SELLING quality (the whole point — failing here = useless brief):
- ЗАГОЛОВОК is a HOOK, not a description. Hits emotion (страх упустить, статус, экономия, удовольствие) or a benefit. Good: «Звук, который окутывает», «Минус 30 минут утром». Bad: «Купите наушники», «Скидка на товар».
- ПОДЗАГОЛОВОК always carries either: (a) a number — price, % скидки, срок акции; (b) urgency — «только сегодня», «осталось 12 шт», «до пятницы»; (c) social proof — «2400+ заказов», «выбор Kaspi». NEVER vague.
- CTA — verb in повелительном: «Заказать», «Забрать», «Попробовать», «Получить». Not «Узнать больше».
- Audience tone bleeds through word choice. Premium → лаконичность, английские слова. Молодёжный → сленг, эмодзи в подзаголовке OK. Семейный → тёплое, про дом/детей. Женский → эмоция, текстуры. Мужской → результат, цифры.
- City/market → currency in ПОДЗАГОЛОВОК. Казахстан → ₸, Россия → ₽, Беларусь → BYN, Узбекистан → сум. Always.
- If "benefit" contains a number, that number MUST appear verbatim in ПОДЗАГОЛОВОК.

INPUT MAY BE SPARSE. If the user only filled 1-2 fields:
- Do NOT echo blank fields. INVENT reasonable defaults based on the product category (use the photo if provided!) and the local market.
- e.g. given only the photo of wireless earbuds — invent a plausible price tier, audience, palette that fits the visual style of the actual product in the photo.
- Better a fully-filled brief with invented but plausible details than a sparse one with «—».

EXAMPLE OUTPUT (study the depth and follow this density):
ЗАГОЛОВОК: «Звук без проводов» · ПОДЗАГОЛОВОК: «−30% до 5 мая · 25 990 ₸ вместо 36 990 ₸» · CTA: «Заказать» · ВИЗУАЛ: премиум минимализм, тёмный режим, палитра — насыщенный графит #1A1A1A, матовое золото #C9A961, кремовый акцент. Атмосфера дорогого магазина гаджетов, мягкий свет. · КОМПОЗИЦИЯ: AirPods в открытом кейсе по центру нижней трети, занимают 40% высоты. Заголовок крупным жирным шрифтом сверху на 2 строки, выровнен по центру. Подзаголовок с ценой — плашка слева внизу под товаром. CTA-кнопка золотая, скруглённая, в правом нижнем углу. · ПРОДУКТ: AirPods под углом 30° сверху, кейс полуоткрыт, виден один наушник внутри. Студийный свет 45° слева, мягкая тень снизу, бликующая фаска кейса. Фон — тёмный градиент от графита к чёрному, лёгкое световое пятно за товаром.

Return ONLY the brief in the exact format above. No markdown, no code fences, no «Вот бриф:» preambles. Start with «ЗАГОЛОВОК:» and end with the last word of the ПРОДУКТ section.`;

interface TzBriefInput {
  subject: string;
  benefit: string;
  audience: string;
  style: string;
  /** Optional city or country the creative targets (free text). */
  cityCountry?: string;
  /**
   * Optional product/subject photo as data: URL. When present, the call
   * switches to multimodal Gemini and the brief is grounded in what's
   * actually visible. Strongly recommended whenever the user has
   * uploaded a photo — drastically improves brief quality.
   */
  photoDataUrl?: string;
  /**
   * Optional human-readable scene description ("на модели", "flat-lay
   * top-down", "в руках с пропсами"). Comes from the editor's "Как
   * показать товар?" picker. Baked into КОМПОЗИЦИЯ/ПРОДУКТ when given.
   */
  sceneHint?: string;
}

/**
 * Strip the data: URL prefix and return { mime, base64 }. Returns null
 * if the input doesn't look like a valid base64 data URL.
 */
function parseDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  if (!dataUrl.startsWith("data:")) return null;
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const header = dataUrl.slice(5, comma); // after "data:"
  const base64 = dataUrl.slice(comma + 1);
  if (!base64) return null;
  const mime = header.split(";")[0] || "image/png";
  return { mime, base64 };
}

export async function generateTzBrief(
  input: TzBriefInput,
): Promise<{ success: true; brief: string } | { success: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Необходима авторизация." };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { success: false, error: "Конфигурация: GEMINI_API_KEY отсутствует." };

  const filled = [
    input.subject?.trim(),
    input.benefit?.trim(),
    input.audience?.trim(),
    input.style?.trim(),
  ].filter(Boolean);
  // Photo alone is enough input — we can write a brief from it even if
  // the user hasn't filled any of the 4 fields yet.
  if (filled.length === 0 && !input.photoDataUrl) {
    return { success: false, error: "Заполни хотя бы одно поле или загрузи фото." };
  }

  const userMessage =
    `Что рекламируем: ${input.subject?.trim() || "(определи из фото)"}\n` +
    `Главная выгода / посыл: ${input.benefit?.trim() || "(придумай уместное)"}\n` +
    `Целевая аудитория: ${input.audience?.trim() || "(подбери под продукт)"}\n` +
    `Стиль и тон: ${input.style?.trim() || "(подбери под продукт)"}` +
    (input.cityCountry?.trim()
      ? `\nГород или страна (рынок): ${input.cityCountry.trim()} — учти валюту и культурный контекст`
      : "") +
    (input.sceneHint?.trim()
      ? `\nКак показать товар: ${input.sceneHint.trim()} — обязательно отрази в КОМПОЗИЦИЯ и ПРОДУКТ секциях`
      : "") +
    (input.photoDataUrl
      ? `\nК сообщению прикреплено реальное фото товара/субъекта — ПРОДУКТ секция должна точно описать что на нём видно (цвет, материал, упаковка, окружение).`
      : "");

  // Build the message parts. Vision call when photo provided, text-only otherwise.
  const photo = input.photoDataUrl ? parseDataUrl(input.photoDataUrl) : null;
  const userParts: Array<Record<string, unknown>> = [{ text: userMessage }];
  if (photo) {
    userParts.push({ inlineData: { mimeType: photo.mime, data: photo.base64 } });
  }

  // Three Gemini attempts before giving up:
  //   1-2. gemini-3-pro-preview (primary, best quality)
  //   3.   gemini-3.1-pro-preview (fallback, often has spare capacity
  //        when 3-pro spikes)
  // Vision calls are slower, so timeout is bumped to 25s when a photo
  // is present. Plain text stays at 15s.
  const MODELS = ["gemini-3-pro-preview", "gemini-3.1-pro-preview"];
  const BACKOFFS_MS = [800, 2500, 5000];
  const TIMEOUT_MS = photo ? 25_000 : 15_000;

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
            contents: [{ role: "user", parts: userParts }],
            generationConfig: { maxOutputTokens: 1500, temperature: 0.85 },
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        },
      );
      if (res.status === 503 || res.status === 429 || res.status >= 500) {
        const text = await res.text().catch(() => "");
        lastError = `Gemini ${res.status} (${model})`;
        console.warn(`[generateTzBrief] ${lastError}, retrying in ${BACKOFFS_MS[attempt]}ms:`, text.slice(0, 200));
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, BACKOFFS_MS[attempt]));
          continue;
        }
        return {
          success: false,
          error: "Серверы Gemini перегружены, попробуй ещё раз через минуту",
        };
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("[generateTzBrief] gemini error:", res.status, text.slice(0, 300));
        return { success: false, error: `Gemini вернул ${res.status}` };
      }
      const data = await res.json();
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const brief = raw.replace(/^["«»\s]+|["«»\s]+$/g, "").trim();
      if (!brief) {
        return { success: false, error: "Пустой ответ от Gemini" };
      }
      return { success: true, brief: brief.slice(0, 1000) };
    } catch (err: any) {
      lastError = err?.message || "fetch failed";
      console.warn("[generateTzBrief] attempt failed:", lastError);
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, BACKOFFS_MS[attempt]));
        continue;
      }
    }
  }
  return {
    success: false,
    error: lastError || "Не удалось сформировать ТЗ",
  };
}
