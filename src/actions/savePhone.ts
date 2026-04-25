"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { auth, currentUser } from "@clerk/nextjs/server";
import { SIGNUP_BONUS_IMPULSES } from "@/lib/pricing";

/**
 * Save the onboarding contacts the user provided on the welcome screen.
 *
 * `phone` is required — it's our primary support channel and also the
 * user's WhatsApp handle (true for essentially every KZ mobile number).
 * `telegramUsername` is optional: if given, the support team can reach
 * them on Telegram for onboarding tips and material.
 *
 * Also flips `welcomeShown=true` so the welcome screen only renders once.
 */
export async function savePhone(
  phone: string,
  telegramUsernameRaw?: string,
) {
  const { userId } = await auth();
  if (!userId) {
    return { success: false as const, error: "Необходима авторизация." };
  }

  // Phone: digits, optional leading +, 10-15 chars.
  const cleanedPhone = phone.replace(/[\s\-()]/g, "");
  if (!/^\+?\d{10,15}$/.test(cleanedPhone)) {
    return {
      success: false as const,
      error: "Введите корректный номер телефона.",
    };
  }

  // Telegram: strip leading @, lowercase. Telegram usernames are 5-32
  // chars, letters/digits/underscore only. Empty string → null.
  let tgUsername: string | null = null;
  const rawTg = telegramUsernameRaw?.trim() ?? "";
  if (rawTg.length > 0) {
    const tg = rawTg.replace(/^@+/, "").toLowerCase();
    if (!/^[a-z0-9_]{5,32}$/.test(tg)) {
      return {
        success: false as const,
        error:
          "Telegram-ник: 5-32 символа, только латиница, цифры и _ (например, @ivan_kz)",
      };
    }
    tgUsername = tg;
  }

  try {
    // Single upsert — combines the previous "update, fall back to insert"
    // pattern into one atomic statement. Removes the race where the
    // Clerk webhook could insert a row between our update (returning 0)
    // and our follow-up insert.
    //
    // Need email/name for the insert path in case the row truly doesn't
    // exist yet (webhook hasn't landed). On the update path Postgres
    // ignores `email`/`name` because they're not in the `set` clause.
    const cu = await currentUser();
    const email = cu?.emailAddresses?.[0]?.emailAddress;
    if (!email) {
      return { success: false as const, error: "Не удалось сохранить контакты." };
    }
    const name =
      [cu?.firstName, cu?.lastName].filter(Boolean).join(" ") ||
      email.split("@")[0];

    await db
      .insert(users)
      .values({
        id: userId,
        email,
        name,
        image: cu?.imageUrl ?? "",
        impulses: SIGNUP_BONUS_IMPULSES,
        phone: cleanedPhone,
        telegramUsername: tgUsername,
        welcomeShown: true,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          phone: cleanedPhone,
          telegramUsername: tgUsername,
          welcomeShown: true,
        },
      });

    return { success: true as const };
  } catch (error: any) {
    console.error("savePhone error:", error);
    return { success: false as const, error: "Не удалось сохранить контакты." };
  }
}
