"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth, currentUser } from "@clerk/nextjs/server";
import { SIGNUP_BONUS_IMPULSES } from "@/lib/pricing";

export async function getUserBalance() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, impulses: SIGNUP_BONUS_IMPULSES }; // default fallback
    }

    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!userRecord) {
      // Lazy creation for users who registered before webhooks existed
      const clerkUser = await currentUser();
      if (clerkUser) {
        const email = clerkUser.emailAddresses[0]?.emailAddress || "unknown";
        await db.insert(users).values({
          id: userId,
          email: email,
          name: clerkUser.firstName || "User",
          image: clerkUser.imageUrl || "",
          impulses: SIGNUP_BONUS_IMPULSES,
        });
        return { success: true, impulses: SIGNUP_BONUS_IMPULSES };
      }
    }

    return { 
      success: true, 
      impulses: userRecord?.impulses ?? 0 
    };
  } catch (error) {
    console.error("Error fetching user balance:", error);
    return { success: false, impulses: SIGNUP_BONUS_IMPULSES };
  }
}
