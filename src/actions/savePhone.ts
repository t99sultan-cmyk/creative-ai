"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
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
    const updated = await db
      .update(users)
      .set({
        phone: cleanedPhone,
        telegramUsername: tgUsername,
        welcomeShown: true,
      })
      .where(eq(users.id, userId))
      .returning({ id: users.id });

    // Race: Clerk's `user.created` webhook is async. If a user hits
    // onboarding before it lands, there is no row to update. Create it.
    if (updated.length === 0) {
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
    }

    return { success: true as const };
  } catch (error: any) {
    console.error("savePhone error:", error);
    return { success: false as const, error: "Не удалось сохранить контакты." };
  }
}
