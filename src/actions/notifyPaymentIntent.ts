"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notifyAdmin, fmt } from "@/lib/admin-notify";

/**
 * Fired from /checkout when the user clicks the Kaspi link / QR.
 * Lets Timur reach out personally while intent is hot.
 *
 * Server action so the Telegram token never reaches the client.
 * Best-effort: never fails the user's path if notification can't go.
 */
export async function notifyPaymentIntent(opts: {
  tier: string;
  priceKzt: number;
  method: "link" | "qr";
}) {
  try {
    const { userId } = await auth();
    let email = "(гость)";
    let name: string | null = null;
    let phone: string | null = null;
    let telegram: string | null = null;
    if (userId) {
      const u = await db
        .select({
          email: users.email,
          name: users.name,
          phone: users.phone,
          telegramUsername: users.telegramUsername,
        })
        .from(users)
        .where(eq(users.id, userId));
      if (u.length > 0) {
        email = u[0].email;
        name = u[0].name;
        phone = u[0].phone;
        telegram = u[0].telegramUsername;
      } else {
        const cu = await currentUser();
        email = cu?.emailAddresses?.[0]?.emailAddress ?? email;
      }
    }

    notifyAdmin(
      `💳 *Намерение оплатить — ${fmt.esc(opts.tier)}*\n\n` +
      `*Email:* ${fmt.esc(email)}\n` +
      (name ? `*Имя:* ${fmt.esc(name)}\n` : "") +
      (phone ? `*Телефон:* \`${fmt.esc(phone)}\`\n` : "") +
      (telegram ? `*Telegram:* @${fmt.esc(telegram)}\n` : "") +
      `*Тариф:* ${fmt.esc(opts.tier)}\n` +
      `*Сумма:* ${opts.priceKzt.toLocaleString("ru-RU")} ₸\n` +
      `*Способ:* ${opts.method === "qr" ? "QR-код" : "ссылка Kaspi"}\n\n` +
      `🔥 _Юзер сейчас в Kaspi — самый горячий момент. Если не оплатит за 5 мин, напомни ему._`,
    );

    return { success: true as const };
  } catch (e: any) {
    console.warn("[notifyPaymentIntent] failed:", e);
    return { success: false as const, error: e?.message ?? "unknown" };
  }
}
