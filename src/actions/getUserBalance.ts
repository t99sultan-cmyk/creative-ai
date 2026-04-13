"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

export async function getUserBalance() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return { success: false, impulses: 17 }; // default fallback
    }

    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    return { 
      success: true, 
      impulses: userRecord?.impulses ?? 17 
    };
  } catch (error) {
    console.error("Error fetching user balance:", error);
    return { success: false, impulses: 17 };
  }
}
