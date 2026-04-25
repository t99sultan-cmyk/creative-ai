/**
 * Admin Telegram push notifications for key product events.
 *
 * Single utility — `notifyAdmin(text)` — used everywhere we want to
 * page Timur on something happening: new sign-ups, payment intents,
 * generation errors, the user spending their last impulse, etc.
 *
 * Hard rules:
 *  - Fire-and-forget. Never blocks the user's path or surfaces errors.
 *  - 3-second timeout. Telegram occasionally hangs; we won't.
 *  - Silent no-op when TELEGRAM_BOT_TOKEN / CHAT_ID aren't configured
 *    (preview deployments, local dev, etc.).
 *  - Markdown is escaped for any string that came from a user.
 *
 * Cost: zero — Telegram Bot API is free for outbound messages.
 */

export async function notifyAdmin(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(3000),
    }).catch((e) => console.error("[notifyAdmin] fetch failed:", e));
  } catch (e) {
    console.error("[notifyAdmin] error:", e);
  }
}

/** Helpers for safe legacy-Markdown formatting. */
export const fmt = {
  /**
   * Escape only the chars Telegram's legacy "Markdown" parser actually
   * treats as syntax: `_`, `*`, `` ` ``, `[`. Previously we escaped the
   * full MarkdownV2 set, which caused literal backslashes to render in
   * front of `.`, `!`, `(`, `)`, `+`, `=`, `-` etc — those aren't
   * reserved in legacy Markdown so escaping them is just visual noise.
   */
  esc(s: unknown): string {
    return String(s ?? "").replace(/([_*`\[])/g, "\\$1");
  },
  /** Truncate to n chars with ellipsis. */
  short(s: unknown, n = 100): string {
    const v = String(s ?? "");
    return v.length > n ? v.slice(0, n) + "…" : v;
  },
  /** Bold a string (already escaped by caller if needed). */
  bold(s: string): string {
    return `*${s}*`;
  },
};
