"use server";

import { db } from "@/db";
import { promoCodes, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

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

    // Find the promo code in the database
    const codeRecord = await db.query.promoCodes.findFirst({
      where: eq(promoCodes.code, cleanCode),
    });

    if (!codeRecord) {
      return { success: false, error: "Промокод не найден." };
    }

    if (codeRecord.isUsed) {
      return { success: false, error: "Этот промокод уже был активирован." };
    }

    // 1. Fetch current user impulses
    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    
    // 2. Safely add impulses (with lazy creation if needed)
    if (!userRecord) {
      const clerkUser = await currentUser();
      const email = clerkUser?.emailAddresses[0]?.emailAddress || "unknown";
      await db.insert(users).values({
        id: userId,
        email: email,
        name: clerkUser?.firstName || "User",
        image: clerkUser?.imageUrl || "",
        impulses: 17 + codeRecord.impulses,
      });
    } else {
      await db.update(users)
        .set({ impulses: (userRecord.impulses || 0) + codeRecord.impulses })
        .where(eq(users.id, userId));
    }

    // 3. Mark code as used
    await db.update(promoCodes)
      .set({
        isUsed: true,
        usedBy: userId,
        usedAt: new Date(),
      })
      .where(eq(promoCodes.code, cleanCode));

    // Revalidate the page so the impulses balance reflects immediately
    revalidatePath("/editor");

    return { 
      success: true, 
      impulsesAdded: codeRecord.impulses 
    };
  } catch (error) {
    console.error("Error redeeming promo code:", error);
    return { success: false, error: "Произошла системная ошибка при активации кода." };
  }
}
