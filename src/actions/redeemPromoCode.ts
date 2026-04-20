"use server";

import { db } from "@/db";
import { promoCodes, users } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

/**
 * Redeem a promo code → add its impulses to the current user's balance.
 *
 * Race-safe: the "mark as used" UPDATE is atomic with a WHERE guard on
 * `isUsed = false`, so if two parallel requests try to redeem the same
 * code, only one UPDATE matches and only that one gets to credit the
 * user. The other sees the guard fail and returns "already activated".
 * Previously the code + mark happened in two separate statements with
 * no guard, letting a determined user redeem one promo twice in quick
 * succession.
 */
export async function redeemPromoCode(code: string) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, error: "Необходима авторизация." };
    }

    if (!code || code.trim() === "") {
      return { success: false, error: "Пожалуйста, введите промокод." };
    }

    const cleanCode = code.trim().toUpperCase();

    // Pre-check: give a nicer "not found" error up front, without an
    // expensive UPDATE. (The real race-safety check is the atomic UPDATE
    // below; this is just UX so we can say "not found" vs "already used".)
    const existing = await db.query.promoCodes.findFirst({
      where: eq(promoCodes.code, cleanCode),
    });

    if (!existing) {
      return { success: false, error: "Промокод не найден." };
    }
    if (existing.isUsed) {
      return { success: false, error: "Этот промокод уже был активирован." };
    }

    // Lazy-create the user row if it doesn't exist (first-time user who
    // hasn't triggered any other write path yet).
    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!userRecord) {
      const clerkUser = await currentUser();
      const email = clerkUser?.emailAddresses[0]?.emailAddress || "unknown";
      await db.insert(users).values({
        id: userId,
        email: email,
        name: clerkUser?.firstName || "User",
        image: clerkUser?.imageUrl || "",
        impulses: 17,
      });
    }

    // ATOMIC claim: only one concurrent request wins this UPDATE.
    const claimed = await db
      .update(promoCodes)
      .set({
        isUsed: true,
        usedBy: userId,
        usedAt: new Date(),
      })
      .where(and(eq(promoCodes.code, cleanCode), eq(promoCodes.isUsed, false)))
      .returning({ impulses: promoCodes.impulses });

    if (claimed.length === 0) {
      // Someone else claimed it in the last 100ms.
      return { success: false, error: "Этот промокод уже был активирован." };
    }

    const added = claimed[0].impulses;

    // Credit the user. Use a DB-side expression so we don't double-add
    // if multiple balance writers interleave.
    await db
      .update(users)
      .set({ impulses: sql`${users.impulses} + ${added}` })
      .where(eq(users.id, userId));

    // Revalidate both pages that show balance so the UI updates fast.
    revalidatePath("/editor");
    revalidatePath("/account");

    return { success: true, impulsesAdded: added };
  } catch (error) {
    console.error("Error redeeming promo code:", error);
    return { success: false, error: "Произошла системная ошибка при активации кода." };
  }
}
