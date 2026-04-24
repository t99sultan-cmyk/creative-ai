import { pgTable, text, timestamp, integer, boolean, real, jsonb, serial } from "drizzle-orm/pg-core";

export const users = pgTable("user", {
  id: text("id").primaryKey(), // Clerk User ID
  name: text("name"),
  email: text("email").notNull(),
  impulses: integer("impulses").default(17), // The internal currency
  image: text("image"),
  phone: text("phone"), // Phone number collected during onboarding
  isBanned: boolean("is_banned").default(false), // Administrative ban status
  createdAt: timestamp("created_at").defaultNow(),
});

export const creatives = pgTable("creative", {
  id: text("id").primaryKey(),
  userId: text("userId").references(() => users.id),
  prompt: text("prompt").notNull(), // The prompt used to generate
  imageUrl: text("imageUrl"), // Result image/thumbnail
  videoUrl: text("videoUrl"), // Result video (if applicable)
  format: text("format"), // Format of the asset (e.g. 9:16)
  cost: integer("cost").default(3), // How many impulses it cost (3 static, 4 animated)
  apiCostKzt: real("api_cost_kzt").default(0), // Actual API cost tracked in KZT
  htmlCode: text("htmlCode"),
  feedbackScore: integer("feedback_score"), // 1 for Like, -1 for Dislike, null for unrated
  feedbackText: text("feedback_text"), // Text comment from user telling the AI what went wrong/right
  createdAt: timestamp("created_at").defaultNow(),
  /** Soft-delete timestamp. When set, the user can no longer see this
   *  creative in their editor history, but it stays in the DB and is
   *  still visible to admins in the CRM (marked as deleted). Enables
   *  "ghost audit" for support and dispute resolution. Nothing is ever
   *  hard-deleted now. */
  deletedAt: timestamp("deleted_at"),
});

/**
 * Audit log for all admin mutations.
 * Never deleted. Lets us trace "who set balance to X for whom, when".
 */
export const adminAuditLog = pgTable("admin_audit_log", {
  id: serial("id").primaryKey(),
  adminId: text("admin_id").notNull(), // Clerk user id of acting admin
  adminEmail: text("admin_email").notNull(),
  action: text("action").notNull(), // e.g. "update_balance", "toggle_ban", "create_promo", "delete_promo"
  targetType: text("target_type"), // "user" | "promo" | null
  targetId: text("target_id"), // user id or promo code
  meta: jsonb("meta"), // action-specific payload (oldBalance, newBalance, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const promoCodes = pgTable("promo_code", {
  code: text("code").primaryKey(), // e.g. "KASPI-XYZ123"
  impulses: integer("impulses").notNull(), 
  isUsed: boolean("is_used").default(false).notNull(),
  usedBy: text("used_by").references(() => users.id),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
