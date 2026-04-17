import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    if (!process.env.FAL_KEY) {
      throw new Error("API Key is not configured.");
    }

    const { niche } = await req.json();

    if (!niche) {
      return NextResponse.json({ error: "Необходимо указать нишу." }, { status: 400 });
    }

    const systemPrompt = `Ты эксперт по маркетингу. Клиент хочет создать крутой рекламный креатив и назвал свою нишу: "${niche}".
Твоя задача: сгенерировать ровно 3 уточняющих вопроса, которые помогут раскрыть суть продукта/предложения для создания идеального ТЗ.
Вопросы должны быть короткими, бьющими в цель и легкими для ответа. 

Пример вопросов для "Фитнес":
1. Какая ваша главная фишка? (Например: бассейн, низкая цена, тренеры-чемпионы)
2. Для кого это? (Новички, профи, мамы в декрете)
3. Какой оффер даем прямо сейчас? (Скидка 50%, первое занятие бесплатно)

ВОЗВРАЩАЙ СТРОГИЙ VALID JSON массив строк! БЕЗ МАРКДАУНА, БЕЗ СЛОВ, ТОЛЬКО МАССИВ.
Пример идеального ответа:
["Вопрос 1", "Вопрос 2", "Вопрос 3"]`;

    const falResponse = await fetch("https://fal.run/fal-ai/any-llm", {
      method: "POST",
      headers: {
        "Authorization": `Key ${process.env.FAL_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: `Сгенерируй 3 вопроса для ниши: ${niche}`,
        system_prompt: systemPrompt,
        model: "anthropic/claude-sonnet-4.5"
      })
    });

    if (!falResponse.ok) {
      const errorText = await falResponse.text();
      console.error("Fal AI API Error:", errorText);
      throw new Error(`Ошибка генерации вопросов: ${falResponse.statusText}`);
    }

    const data = await falResponse.json();
    
    // Parse the JSON array
    let questions = [];
    try {
        const rawText = data.output.replace(/```json/g, "").replace(/```/g, "").trim();
        questions = JSON.parse(rawText);
    } catch(e) {
        // Fallback robust parsing if Claude hallucinates
        console.error("Failed to parse JSON, falling back", data.output);
        questions = data.output.split('\n').filter((l: string) => l.trim().length > 5).slice(0, 3);
    }

    return NextResponse.json({ questions });

  } catch (error: any) {
    console.error("Generate Questions Error:", error);
    return NextResponse.json({ error: error.message || "Ошибка сервера" }, { status: 500 });
  }
}
