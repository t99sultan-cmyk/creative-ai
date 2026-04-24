"use server";

import { db } from "@/db";
import { users, promoCodes, creatives } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { auth, currentUser } from "@clerk/nextjs/server";
import { SIGNUP_BONUS_IMPULSES } from "@/lib/pricing";

/**
 * Data for the /account page: balance, profile, promo history, generation
 * count. One server action per page — the whole dashboard renders off
 * a single round-trip instead of 3-4 parallel fetches.
 */
export async function getAccountData() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false as const, error: "Необходима авторизация." };
    }

    // Lazy-create user row if needed, same pattern as getUserBalance.
    let userRecord = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!userRecord) {
      const clerkUser = await currentUser();
      if (clerkUser) {
        const email = clerkUser.emailAddresses[0]?.emailAddress || "unknown";
        await db.insert(users).values({
          id: userId,
          email,
          name: clerkUser.firstName || "User",
          image: clerkUser.imageUrl || "",
          impulses: SIGNUP_BONUS_IMPULSES,
        });
        userRecord = await db.query.users.findFirst({ where: eq(users.id, userId) });
      }
    }

    // Promo-code redemption history (all codes this user has ever used)
    const usedPromos = await db
      .select({
        code: promoCodes.code,
        impulses: promoCodes.impulses,
        usedAt: promoCodes.usedAt,
      })
      .from(promoCodes)
      .where(and(eq(promoCodes.isUsed, true), eq(promoCodes.usedBy, userId)))
      .orderBy(desc(promoCodes.usedAt))
      .limit(50);

    // Aggregate: total generations so the user sees their activity.
    const genStats = await db
      .select({
        total: sql<number>`count(*)::int`,
        animated: sql<number>`count(*) filter (where ${creatives.cost} > 3)::int`,
      })
      .from(creatives)
      .where(eq(creatives.userId, userId));

    return {
      success: true as const,
      balance: userRecord?.impulses ?? 0,
      profile: {
        email: userRecord?.email ?? null,
        name: userRecord?.name ?? null,
        image: userRecord?.image ?? null,
        isBanned: userRecord?.isBanned ?? false,
      },
      promoHistory: usedPromos,
      generationStats: {
        total: genStats[0]?.total ?? 0,
        animated: genStats[0]?.animated ?? 0,
      },
    };
  } catch (error: any) {
    console.error("getAccountData error:", error);
    return { success: false as const, error: error.message || "Не удалось загрузить данные" };
  }
}
