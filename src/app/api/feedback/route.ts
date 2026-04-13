import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { creatives, users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { creativeId, score, comment } = await request.json();

    if (!creativeId) {
       return new Response(JSON.stringify({ error: "No creative ID provided" }), { status: 400 });
    }

    // 1. Update DB Target
    await db.update(creatives)
      .set({ 
        feedbackScore: score, 
        feedbackText: comment,
      })
      .where(eq(creatives.id, creativeId));

    // 2. Fetch data to send to Telegram
    const creativeData = await db.select().from(creatives).where(eq(creatives.id, creativeId));
    const userData = await db.select().from(users).where(eq(users.id, userId));
    
    if (creativeData.length > 0) {
       const user = userData[0];
       const creative = creativeData[0];
       
       const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
       const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

       if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
          const emoji = score === 1 ? "🟢 ПОЛОЖИТЕЛЬНЫЙ" : "🔴 НЕГАТИВНЫЙ";
          let message = `*Новый отзыв с сайта AICreative* ${emoji}\n\n`;
          message += `*Пользователь:* ${user?.email || 'Неизвестно'}\n`;
          message += `*Формат:* ${creative.format}\n`;
          message += `*Промпт/ТЗ:* _${creative.prompt}_\n\n`;
          if (comment) {
             message += `*Комментарий юзера:* ${comment}\n\n`;
          }
          message += `_Креатив ID: ${creative.id}_`;

          // Send to Telegram
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
               chat_id: TELEGRAM_CHAT_ID,
               text: message,
               parse_mode: 'Markdown'
             })
          }).catch(err => console.error("Telegram send error", err));
       }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error: any) {
    console.error('Feedback Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
