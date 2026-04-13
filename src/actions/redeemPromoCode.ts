"use server";

import { db } from "@/db";
import { promoCodes, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
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

    // Since neon-http backend acts a bit differently with transactions, we can run sequential updates safely enough here, 
    // but ideally we wrap in transaction. Let's try transaction if it's supported:
    await db.transaction(async (tx) => {
      // 1. Mark code as used
      await tx
        .update(promoCodes)
        .set({
          isUsed: true,
          usedBy: userId,
          usedAt: new Date(),
        })
        .where(eq(promoCodes.code, cleanCode));

      // 2. Fetch current user impulses to add
      const userRecord = await tx.query.users.findFirst({
        where: eq(users.id, userId),
      });
      
      const currentImpulses = userRecord?.impulses || 0;

      // 3. Update user impulses
      await tx
        .update(users)
        .set({
          impulses: currentImpulses + codeRecord.impulses,
        })
        .where(eq(users.id, userId));
    });

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
