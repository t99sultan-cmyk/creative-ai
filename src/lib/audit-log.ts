import { db } from "@/db";
import { adminAuditLog } from "@/db/schema";
import { currentUser } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";

export type AdminAction =
  | "update_balance"
  | "toggle_ban"
  | "create_promo"
  | "delete_promo"
  | "delete_user";

export type AdminAuditMeta = Record<string, unknown>;

/**
 * Record an admin mutation for traceability.
 * Swallows errors — logging must never break the actual action.
 *
 * Always called AFTER the mutation succeeded.
 */
export async function recordAdminAction(params: {
  action: AdminAction;
  targetType?: "user" | "promo" | null;
  targetId?: string | null;
  meta?: AdminAuditMeta;
}): Promise<void> {
  try {
    const user = await currentUser();
    if (!user) return;
    const email = user.emailAddresses?.[0]?.emailAddress ?? "unknown";

    await db.insert(adminAuditLog).values({
      adminId: user.id,
      adminEmail: email,
      action: params.action,
      targetType: params.targetType ?? null,
      targetId: params.targetId ?? null,
      meta: (params.meta ?? {}) as any,
    });
  } catch (e) {
    console.error("[audit-log] failed to record admin action:", e);
  }
}

/**
 * Fetch the most recent audit entries. Admin-gated at the caller level.
 */
export async function getRecentAuditLog(limit = 100) {
  return db
    .select()
    .from(adminAuditLog)
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(limit);
}

/**
 * Fetch audit entries for a specific user.
 */
export async function getAuditLogForUser(userId: string, limit = 50) {
  return db
    .select()
    .from(adminAuditLog)
    .where(eq(adminAuditLog.targetId, userId))
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(limit);
}
