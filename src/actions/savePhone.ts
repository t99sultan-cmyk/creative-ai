"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

export async function savePhone(phone: string) {
  const { userId } = await auth();
  if (!userId) {
    return { success: false as const, error: "Необходима авторизация." };
  }

  // Basic validation: digits, optional leading +, 10-15 chars
  const cleaned = phone.replace(/[\s\-()]/g, "");
  if (!/^\+?\d{10,15}$/.test(cleaned)) {
    return { success: false as const, error: "Введите корректный номер телефона." };
  }

  try {
    const updated = await db
      .update(users)
      .set({ phone: cleaned })
      .where(eq(users.id, userId))
      .returning({ id: users.id });

    // Race: Clerk's `user.created` webhook is async. If a user hits onboarding
    // before it lands, there is no row to update — returning() is empty. In
    // that case create the row ourselves from Clerk's data so the phone is
    // never silently lost.
    if (updated.length === 0) {
      const cu = await currentUser();
      const email = cu?.emailAddresses?.[0]?.emailAddress;
      if (!email) {
        return { success: false as const, error: "Не удалось сохранить номер." };
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
          impulses: 10,
          phone: cleaned,
        })
        .onConflictDoUpdate({
          target: users.id,
          set: { phone: cleaned },
        });
    }

    return { success: true as const };
  } catch (error: any) {
    console.error("savePhone error:", error);
    return { success: false as const, error: "Не удалось сохранить номер." };
  }
}
