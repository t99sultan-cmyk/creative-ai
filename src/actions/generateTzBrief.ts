"use server";

import { auth } from "@clerk/nextjs/server";

/**
 * Builds a polished Russian advertising brief from the 4-question
 * helper in the editor. Calls Gemini 2.5 Flash directly — fast
 * (~1-2 sec) and cheap (~$0.0001 per call).
 *
 * The output is meant to drop straight into the prompt textarea as
 * the brief sent to image-gen models (Gemini 3 Pro Image / GPT
 * Image 2). Keep it concise — long prompts hurt image-gen quality.
 */

const SYSTEM_PROMPT = `You are a senior copywriter for paid social ads (Instagram / TikTok).
Given 4 short fields about a product/campaign, write a single concise Russian brief (60-200 chars) optimized for an AI image generator.

The brief must:
- Lead with the product noun
- State the unique benefit / hook in punchy active voice
- Reflect the audience tone implicitly (don't write "for X audience")
- End with a one-word style cue
- Read like a designer's brief, not marketing copy

Return ONLY the brief text. No quotes, no commentary, no markdown.`;

interface TzBriefInput {
  subject: string;
  benefit: string;
  audience: string;
  style: string;
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
  if (filled.length === 0) {
    return { success: false, error: "Заполни хотя бы одно поле." };
  }

  const userMessage =
    `Что рекламируем: ${input.subject?.trim() || "—"}\n` +
    `Главная выгода / посыл: ${input.benefit?.trim() || "—"}\n` +
    `Целевая аудитория: ${input.audience?.trim() || "—"}\n` +
    `Стиль и тон: ${input.style?.trim() || "—"}`;

  // Primary: Gemini 3 Pro Preview (text). On transient 503/429/5xx,
  // retry the same model with backoff; if it's still overloaded after
  // 2 retries, fall back once to Gemini 3.1 Pro Preview (newer line,
  // sometimes has spare capacity when 3-pro spikes).
  const MODELS = ["gemini-3-pro-preview", "gemini-3.1-pro-preview"];
  const BACKOFFS_MS = [800, 2500, 5000];

  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const model = attempt < 2 ? MODELS[0] : MODELS[1]; // last attempt switches model
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ role: "user", parts: [{ text: userMessage }] }],
            generationConfig: { maxOutputTokens: 256, temperature: 0.7 },
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (res.status === 503 || res.status === 429 || res.status >= 500) {
        // Transient — wait and retry.
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
      return { success: true, brief: brief.slice(0, 240) };
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
