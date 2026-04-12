import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    if (!process.env.FAL_KEY) {
      throw new Error("FAL_KEY is not configured.");
    }

    const { niche, qnaList } = await req.json();

    if (!niche) {
      return NextResponse.json({ error: "Необходимо указать нишу." }, { status: 400 });
    }
    
    // Format the Q&A for the AI
    let userAnswersText = "Нет ответов";
    if (qnaList && qnaList.length > 0) {
        userAnswersText = qnaList.map((item: any, i: number) => `Вопрос ИИ: ${item.q}\nОтвет клиента: ${item.a}`).join("\n\n");
    }

    const systemPrompt = `Ты профессиональный Performance-копирайтер. 
Твоя задача — сгенерировать ИДЕАЛЬНЫЙ, КОРОТКИЙ текстовый сценарий для рекламного креатива.

Тебе переданы:
1. НИША: ${niche}
2. БРИФ ОТ КЛИЕНТА:\n${userAnswersText}

СТРОГИЕ ТРЕБОВАНИЯ К ВЫВОДУ ТЕКСТА:
- НИКАКОГО ДИЗАЙНА. НИКАКИХ СТРУКТУР. НИКАКОГО МАРКДАУНА. Не пиши слова "ТЗ для дизайнера", "Проект", "Дедлайн" и т.п.
- Не используй символы ## или ** или \`\`\`. 
- ВЫВЕДИ ТОЛЬКО 3 строчки простого текста, разделенные переносом строки. Больше ничего!

ФОРМАТ СТРОГИЙ:
Заголовок: [Короткий, до 5 слов]
Подзаголовок: [Суть оффера в 1 предложение]
Кнопка: [Призыв из 2 слов]

ВАЖНО ПРО ЦЕНЫ И ВАЛЮТУ:
- Если в брифе или нише НЕТ конкретной цены, скидки или процентов — НЕ ПИШИ ИХ! Сделай упор на качество или выгоду без цифр.
- Если в брифе ЕСТЬ цена, ВСЕГДА используй валюту Тенге (знак ₸), если клиет явно не попросил другую. (Никогда не используй рубли ₽).`;

    const falResponse = await fetch("https://fal.run/fal-ai/any-llm", {
      method: "POST",
      headers: {
        "Authorization": `Key ${process.env.FAL_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: "Напиши ТЗ для дизайнера.",
        system_prompt: systemPrompt,
        model: "anthropic/claude-sonnet-4.5"
      })
    });

    if (!falResponse.ok) {
      const errorText = await falResponse.text();
      console.error("Fal AI API Errror:", errorText);
      throw new Error(`Ошибка от Fal AI: ${falResponse.statusText}`);
    }

    const data = await falResponse.json();
    return NextResponse.json({ enhancedPrompt: data.output });

  } catch (error: any) {
    console.error("Enhance Prompt Error:", error);
    return NextResponse.json({ error: error.message || "Произошла ошибка генерации идеи" }, { status: 500 });
  }
}
