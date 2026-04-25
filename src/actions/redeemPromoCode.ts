"use server";

import { db } from "@/db";
import { promoCodes, users } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { sendCapiEvent } from "@/lib/fb-capi";
import { estimateRevenueKztFromImpulses, SIGNUP_BONUS_IMPULSES } from "@/lib/pricing";
import { notifyAdmin, fmt } from "@/lib/admin-notify";

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
        impulses: SIGNUP_BONUS_IMPULSES,
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

    // Mirror the browser-pixel Purchase fire via Meta CAPI so the
    // conversion still lands even if the user's browser blocks Meta
    // requests (iOS ATT, ad-blockers). Event id matches what
    // `trackPurchase` sends from the client — Meta dedupes the pair.
    //
    // We resolve the user's email lazily: if we just inserted the row
    // above we have `clerkUser`, otherwise we use whatever is on the
    // existing DB row (which Clerk keeps fresh via webhook).
    try {
      const headerPayload = await headers();
      const capiEmail =
        userRecord?.email ||
        (await currentUser())?.emailAddresses[0]?.emailAddress ||
        undefined;

      await sendCapiEvent({
        eventName: "Purchase",
        eventId: `promo_${cleanCode}`,
        user: {
          email: capiEmail,
          externalId: userId,
          clientIp:
            headerPayload.get("x-forwarded-for")?.split(",")[0].trim() ??
            undefined,
          clientUserAgent: headerPayload.get("user-agent") ?? undefined,
        },
        customData: {
          value: estimateRevenueKztFromImpulses(added),
          currency: "KZT",
          content_name: `+${added} impulses`,
          content_ids: [cleanCode],
          content_category: "promo_redemption",
          num_items: 1,
        },
      });
    } catch (capiErr) {
      // Never fail a real redemption because of a Meta call. Log and move on.
      console.error("[redeemPromoCode] CAPI Purchase failed:", capiErr);
    }

    // Telegram pings for redemption + first-redemption-ever (= first
    // paid promo activation in user's lifetime).
    try {
      const userRow = await db
        .select({ email: users.email, name: users.name, impulses: users.impulses })
        .from(users)
        .where(eq(users.id, userId));
      const usedCount = await db
        .select({ c: sql<number>`count(*)::int` })
        .from(promoCodes)
        .where(and(eq(promoCodes.isUsed, true), eq(promoCodes.usedBy, userId)));
      const totalRedeemed = usedCount[0]?.c ?? 0;

      const isFirstEver = totalRedeemed === 1;
      const revenueKzt = estimateRevenueKztFromImpulses(added);

      notifyAdmin(
        `${isFirstEver ? "🆕💰 *ПЕРВЫЙ ПЛАТЁЖ В ЖИЗНИ ЮЗЕРА*" : "🎁 *Активация промокода*"}\n\n` +
        `*Email:* ${fmt.esc(userRow[0]?.email ?? userId)}\n` +
        (userRow[0]?.name ? `*Имя:* ${fmt.esc(userRow[0].name)}\n` : "") +
        `*Промокод:* \`${fmt.esc(cleanCode)}\`\n` +
        `*Начислено:* +${added} ⚡\n` +
        `*Новый баланс:* ${userRow[0]?.impulses ?? "?"} ⚡\n` +
        `*Оценка выручки:* ~${revenueKzt.toLocaleString("ru-RU")} ₸\n` +
        `*Всего активаций у юзера:* ${totalRedeemed}` +
        (isFirstEver ? `\n\n🎉 _Это его первый раз. Закрепи отношения._` : ""),
      );
    } catch (notifyErr) {
      console.warn("[redeemPromoCode] notifyAdmin failed:", notifyErr);
    }

    return { success: true, impulsesAdded: added };
  } catch (error) {
    console.error("Error redeeming promo code:", error);
    return { success: false, error: "Произошла системная ошибка при активации кода." };
  }
}
