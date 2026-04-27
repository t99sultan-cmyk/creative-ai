import { pgTable, text, timestamp, integer, boolean, real, jsonb, serial } from "drizzle-orm/pg-core";

export const users = pgTable("user", {
  id: text("id").primaryKey(), // Clerk User ID
  name: text("name"),
  email: text("email").notNull(),
  // Internal currency. Default mirrors SIGNUP_BONUS_IMPULSES in @/lib/pricing;
  // kept literal here because drizzle schema is evaluated at migration-gen
  // time and can't import runtime constants. If the bonus changes, bump
  // both values.
  impulses: integer("impulses").default(12),
  image: text("image"),
  phone: text("phone"), // Phone number collected during onboarding (also used as WhatsApp contact)
  // Optional Telegram handle (without the @). Collected on the welcome
  // screen so the team can reach out with onboarding material, tips, and
  // support messages. Nullable — users who don't have or don't want to
  // share Telegram skip it.
  telegramUsername: text("telegram_username"),
  // Flag: has the user seen the post-signup welcome screen yet? Lets us
  // redirect returning users straight into /editor and show the intro
  // + phone-capture form exactly once per account.
  welcomeShown: boolean("welcome_shown").default(false).notNull(),
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
  cost: integer("cost").default(6), // Импульсы за генерацию. Pair = одна dual-генерация: 6 static / 8 animated. Stored on EACH row of the pair, total user-paid = cost (not 2×cost).
  apiCostKzt: real("api_cost_kzt").default(0), // Actual API cost tracked in KZT
  htmlCode: text("htmlCode"),
  feedbackScore: integer("feedback_score"), // 1 for Like, -1 for Dislike, null for unrated
  feedbackText: text("feedback_text"), // Text comment from user telling the AI what went wrong/right
  // Public-by-default. When true the creative shows up in the public
  // inspiration gallery in the editor; when false it stays in the
  // author's history only. The user toggles this from /account.
  // Disliked creatives are excluded from the gallery regardless.
  isPublic: boolean("is_public").default(true).notNull(),
  /** Какая модель породила этот HTML — 'claude' (Claude Opus 4.7) или
   *  'gemini' (Gemini 3.1 Pro). Default = 'claude' для legacy строк где
   *  колонка появилась после факта. Используется для:
   *    1. Показать юзеру badge модели в превью
   *    2. Vision-refine — отправить запрос той же модели что породила
   *    3. Аналитика winrate Claude vs Gemini по нишам. */
  model: text("model").default("claude").notNull(),
  /** UUID, общий для двух sibling-creative'ов одной dual-генерации.
   *  null = legacy одиночный creative или refine. */
  pairId: text("pair_id"),
  /** FK self → creative.id. Если this creative — refined версия (vision-
   *  loop "Улучшить"), указывает на источник. null для оригиналов. */
  parentCreativeId: text("parent_creative_id"),
  /** Pair-vote результат. null = юзер ещё не выбрал, true = победитель,
   *  false = проигравший. Только победители показываются в публичной
   *  галерее. Аггрегация по (model, niche) даёт winrate-телеметрию. */
  selectedAsBest: boolean("selected_as_best"),
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
