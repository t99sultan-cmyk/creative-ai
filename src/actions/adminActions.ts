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
    
    // Get all creatives for stats
    const allCreatives = await db.select().from(creatives);
    
    // Get all used promos for stats
    const usedPromos = await db.select().from(promoCodes).where(eq(promoCodes.isUsed, true));

    // Enrich users with stats
    const enrichedUsers = allUsers.map(u => {
      const uCreatives = allCreatives.filter(c => c.userId === u.id);
      const likes = uCreatives.filter(c => c.feedbackScore === 1).length;
      const dislikes = uCreatives.filter(c => c.feedbackScore === -1).length;
      const uPromos = usedPromos.filter(p => p.usedBy === u.id).sort((a,b) => (b.usedAt?.getTime() || 0) - (a.usedAt?.getTime() || 0));

      return {
        ...u,
        totalGenerations: uCreatives.length,
        likes,
        dislikes,
        promosUsed: uPromos
      };
    });
    
    // Get all active (unused) promo codes
    const activePromos = await db.select()
                           .from(promoCodes)
                           .where(eq(promoCodes.isUsed, false))
                           .orderBy(desc(promoCodes.createdAt));
                           
    // Basic stats
    return { 
      success: true, 
      users: enrichedUsers, 
      activePromos, 
      stats: {
        totalUsers: allUsers.length,
        totalGenerations: allCreatives.length
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

export async function deletePromoCode(code: string) {
  if (!(await isAdmin())) {
    return { success: false, error: "Access Denied" };
  }

  try {
    await db.delete(promoCodes).where(eq(promoCodes.code, code));
    return { success: true };
  } catch (e: any) {
    console.error("Error deleting promo:", e);
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
