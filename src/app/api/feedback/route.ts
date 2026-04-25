import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { creatives, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { fmt } from '@/lib/admin-notify';

const SCREENSHOT_URL =
  'https://creative-cloud-renderer-694906438875.europe-west4.run.app/screenshot';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { creativeId, score, comment } = await request.json();
    if (!creativeId) {
      return new Response(JSON.stringify({ error: 'No creative ID provided' }), { status: 400 });
    }

    // 1) Persist feedback ────────────────────────────────────────
    await db
      .update(creatives)
      .set({ feedbackScore: score, feedbackText: comment })
      .where(eq(creatives.id, creativeId));

    // 2) Pull creative + user for the Telegram payload ───────────
    const creativeData = await db
      .select()
      .from(creatives)
      .where(eq(creatives.id, creativeId));
    const userData = await db.select().from(users).where(eq(users.id, userId));

    if (creativeData.length === 0) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    const user = userData[0];
    const creative = creativeData[0];
    const isAnimated = (creative.cost ?? 0) > 3;
    const verdict = score === 1 ? '👍 ЛАЙК' : '👎 ДИЗЛАЙК';
    const emojiHeader = score === 1 ? '🟢' : '🔴';

    const caption =
      `${emojiHeader} *${verdict}* — ${isAnimated ? 'анимация' : 'статика'} ${creative.format ?? ''}\n\n` +
      `*Юзер:* ${fmt.esc(user?.email || 'Неизвестно')}\n` +
      (user?.name ? `*Имя:* ${fmt.esc(user.name)}\n` : '') +
      `*Промпт:* ${fmt.esc(fmt.short(creative.prompt ?? '', 250))}\n` +
      (comment ? `*Комментарий:* ${fmt.esc(fmt.short(comment, 200))}\n` : '') +
      `\n_ID креатива: \`${fmt.esc(creative.id)}\`_`;

    // 3) Build the Telegram payload ──────────────────────────────
    // Animation → send a text + clickable video URL (faster, no
    // re-render). Static → fetch a fresh screenshot from GCP Cloud
    // Run and upload it to TG as a photo so Timur sees the result
    // inline without opening anything.
    if (isAnimated && creative.videoUrl && !/^(rendering|failed):/.test(creative.videoUrl)) {
      const videoUrl = creative.videoUrl;
      try {
        const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            video: videoUrl,
            caption,
            parse_mode: 'Markdown',
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (!r.ok) {
          // sendVideo can refuse remote URLs >20MB or non-MP4. Fall
          // back to a plain text message with a tappable link.
          await sendPlainText(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
            `${caption}\n\n[Видео](${videoUrl})`);
        }
      } catch (e) {
        await sendPlainText(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
          `${caption}\n\n[Видео](${videoUrl})`);
      }
    } else if (creative.htmlCode) {
      try {
        const shotRes = await fetch(SCREENSHOT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            html: creative.htmlCode,
            format: creative.format ?? '1:1',
          }),
          signal: AbortSignal.timeout(20_000),
        });
        if (!shotRes.ok) throw new Error(`Screenshot HTTP ${shotRes.status}`);
        const png = await shotRes.arrayBuffer();

        // Upload screenshot as multipart/form-data to Telegram. Photo
        // attached inline so Timur scrolls his TG and sees pictures of
        // every rated creative without clicks.
        const form = new FormData();
        form.set('chat_id', TELEGRAM_CHAT_ID);
        form.set('caption', caption);
        form.set('parse_mode', 'Markdown');
        form.set(
          'photo',
          new Blob([png], { type: 'image/png' }),
          `creative-${creative.id}.png`,
        );
        const tgRes = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
          { method: 'POST', body: form, signal: AbortSignal.timeout(15_000) },
        );
        if (!tgRes.ok) {
          const tgText = await tgRes.text().catch(() => '');
          console.warn('[feedback] TG sendPhoto failed', tgRes.status, tgText.slice(0, 200));
          await sendPlainText(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, caption);
        }
      } catch (e) {
        console.warn('[feedback] screenshot pipeline failed:', e);
        await sendPlainText(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, caption);
      }
    } else {
      await sendPlainText(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, caption);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error: any) {
    console.error('Feedback Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}

async function sendPlainText(token: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: false,
    }),
    signal: AbortSignal.timeout(5000),
  }).catch((e) => console.error('[feedback] plainText send failed', e));
}
