"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, promoCodes, creatives } from "@/db/schema";
import { desc, eq, isNull } from "drizzle-orm";
import crypto from "crypto";

// Security Check helper
const isAdmin = async () => {
  const user = await currentUser();
  if (!user) return false;
  
  const email = user.emailAddresses[0]?.emailAddress;
  const adminEmailsVar = process.env.ADMIN_EMAILS || "timur@... (fallback none)"; 
  // We expect a comma separated list like: "admin@aicreative.kz,timur@ya.ru"
  
  const adminEmails = adminEmailsVar.split(",").map(e => e.trim().toLowerCase());
  return adminEmails.includes(email.toLowerCase());
};

export async function getAdminDashboardData() {
  if (!(await isAdmin())) {
    return { success: false, error: "Access Denied" };
  }

  try {
    // Get all users
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt)).limit(100);
    
    // Get all active (unused) promo codes
    const activePromos = await db.select()
                           .from(promoCodes)
                           .where(eq(promoCodes.isUsed, false))
                           .orderBy(desc(promoCodes.createdAt));
                           
    // Basic stats
    const totalCreatives = await db.select().from(creatives);

    return { 
      success: true, 
      users: allUsers, 
      activePromos, 
      stats: {
        totalUsers: allUsers.length,
        totalGenerations: totalCreatives.length
      } 
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function createPromoCode(impulses: number) {
  if (!(await isAdmin())) {
    return { success: false, error: "Access Denied" };
  }

  try {
    // Generate a unique strong code "PROMO-A1B2-C3D4"
    const fragment1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const fragment2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const code = `PROMO-${impulses}-${fragment1}-${fragment2}`;

    await db.insert(promoCodes).values({
      code,
      impulses,
      isUsed: false
    });

    return { success: true, code };
  } catch (e: any) {
    console.error("Error creating promo:", e);
    return { success: false, error: e.message };
  }
}

export async function updateUserImpulses(userId: string, newBalance: number) {
  if (!(await isAdmin())) {
    return { success: false, error: "Access Denied" };
  }

  try {
    await db.update(users)
      .set({ impulses: newBalance })
      .where(eq(users.id, userId));
      
    // Create lazily if they somehow don't exist yet but appear in some UI
    const existingUser = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!existingUser) {
        await db.insert(users).values({
            id: userId,
            email: "unknown/lazy-created@aicreative.kz",
            impulses: newBalance
        });
    }

    return { success: true };
  } catch (e: any) {
    console.error("Error updating user balances:", e);
    return { success: false, error: e.message };
  }
}

export async function getUserHistory(userId: string) {
  if (!(await isAdmin())) {
    return { success: false, error: "Access Denied" };
  }

  try {
    const history = await db.select()
      .from(creatives)
      .where(eq(creatives.userId, userId))
      .orderBy(desc(creatives.createdAt));

    return { success: true, history };
  } catch (e: any) {
    console.error("Error fetching user history:", e);
    return { success: false, error: e.message };
  }
}
