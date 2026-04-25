"use server";

import { db } from "@/db";
import { users, promoCodes, creatives } from "@/db/schema";
import { and, desc, eq, gte, ilike, inArray, lt, or, sql } from "drizzle-orm";
import crypto from "crypto";
import { isAdmin } from "@/lib/admin-guard";
import { recordAdminAction, getRecentAuditLog, getAuditLogForUser } from "@/lib/audit-log";
import { estimateRevenueKztFromImpulses, avgKztPerImpulse, SIGNUP_BONUS_IMPULSES } from "@/lib/pricing";

// ---- Validation limits ----
const MIN_BALANCE = 0;
const MAX_BALANCE = 100_000; // 100k impulses — way above any reasonable topup
const MIN_PROMO_IMPULSES = 1;
const MAX_PROMO_IMPULSES = 10_000;

// ---- Pagination limits ----
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export type UserStatusFilter = "all" | "active" | "banned" | "low_balance";

export type DashboardQuery = {
  search?: string; // email substring
  status?: UserStatusFilter;
  page?: number; // 1-based
  pageSize?: number;
};

export async function getAdminDashboardData(query: DashboardQuery = {}) {
  if (!(await isAdmin())) {
    return { success: false, error: "Access Denied" };
  }

  try {
    // ---- Normalize pagination / filters ----
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(query.pageSize ?? DEFAULT_PAGE_SIZE)));
    const offset = (page - 1) * pageSize;
    const status: UserStatusFilter = query.status ?? "all";
    const search = (query.search ?? "").trim();

    // ---- Build WHERE clauses for the users table ----
    const where: any[] = [];
    if (search.length > 0) {
      where.push(ilike(users.email, `%${search}%`));
    }
    if (status === "banned") {
      where.push(eq(users.isBanned, true));
    } else if (status === "active") {
      where.push(or(eq(users.isBanned, false), sql`${users.isBanned} IS NULL`));
    } else if (status === "low_balance") {
      where.push(lt(users.impulses, 10));
    }
    const combinedWhere = where.length > 0 ? and(...where) : undefined;

    // ---- Query paginated users + total count in parallel ----
    // Aggregate stats (generations, likes, API cost) are computed in SQL
    // and scoped ONLY to the paginated user IDs, so we never pull the whole
    // creatives table into JS. This replaces the old O(pageSize × totalCreatives)
    // in-memory `.filter()` loop that would have frozen the admin dashboard
    // once the creatives table grew past a few thousand rows.
    const [pagedUsers, totalRows, activePromos, totalCreativesCount] = await Promise.all([
      db.select()
        .from(users)
        .where(combinedWhere as any)
        .orderBy(desc(users.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ c: sql<number>`count(*)::int` })
        .from(users)
        .where(combinedWhere as any),
      db.select().from(promoCodes).where(eq(promoCodes.isUsed, false)).orderBy(desc(promoCodes.createdAt)),
      db.select({ c: sql<number>`count(*)::int` }).from(creatives),
    ]);

    const totalCount = totalRows[0]?.c ?? 0;
    const totalGenerationsAll = totalCreativesCount[0]?.c ?? 0;

    // If this page of users is empty, skip aggregate queries entirely.
    const pageUserIds = pagedUsers.map(u => u.id);

    let creativeStatsByUser = new Map<string, {
      totalGenerations: number;
      totalApiCostKzt: number;
      likes: number;
      dislikes: number;
    }>();
    let promosByUser = new Map<string, any[]>();

    if (pageUserIds.length > 0) {
      // SQL-side aggregates: ONE query, scoped to THIS PAGE's user IDs.
      // NOTE: Neon's parameterization turns a naive `sql\`... = ANY(${arr})\``
      // into `ANY($1, $2, $3)` which is invalid. Drizzle's `inArray(col, arr)`
      // properly generates `col IN (?, ?, ?)` (or the equivalent) with a
      // single-parameter-per-value binding that Postgres accepts.
      const [creativeAgg, usedPromosScoped] = await Promise.all([
        db
          .select({
            userId: creatives.userId,
            totalGenerations: sql<number>`count(*)::int`,
            totalApiCostKzt: sql<number>`coalesce(sum(${creatives.apiCostKzt}), 0)::float`,
            likes: sql<number>`count(*) filter (where ${creatives.feedbackScore} = 1)::int`,
            dislikes: sql<number>`count(*) filter (where ${creatives.feedbackScore} = -1)::int`,
          })
          .from(creatives)
          .where(inArray(creatives.userId, pageUserIds))
          .groupBy(creatives.userId),
        db
          .select()
          .from(promoCodes)
          .where(
            and(
              eq(promoCodes.isUsed, true),
              inArray(promoCodes.usedBy, pageUserIds),
            ),
          )
          .orderBy(desc(promoCodes.usedAt)),
      ]);

      for (const row of creativeAgg) {
        if (!row.userId) continue;
        creativeStatsByUser.set(row.userId, {
          totalGenerations: row.totalGenerations ?? 0,
          totalApiCostKzt: row.totalApiCostKzt ?? 0,
          likes: row.likes ?? 0,
          dislikes: row.dislikes ?? 0,
        });
      }
      for (const p of usedPromosScoped) {
        if (!p.usedBy) continue;
        const arr = promosByUser.get(p.usedBy) ?? [];
        arr.push(p);
        promosByUser.set(p.usedBy, arr);
      }
    }

    const enrichedUsers = pagedUsers.map(u => {
      const stats = creativeStatsByUser.get(u.id) ?? {
        totalGenerations: 0,
        totalApiCostKzt: 0,
        likes: 0,
        dislikes: 0,
      };
      return {
        ...u,
        totalGenerations: stats.totalGenerations,
        totalApiCostKzt: stats.totalApiCostKzt,
        likes: stats.likes,
        dislikes: stats.dislikes,
        promosUsed: promosByUser.get(u.id) ?? [],
      };
    });

    return {
      success: true,
      users: enrichedUsers,
      activePromos,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
      },
      query: { search, status },
      stats: {
        totalUsers: totalCount,
        totalGenerations: totalGenerationsAll,
      },
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Financial + activity dashboard.
 * Reliable metrics (users, generations, API costs) come from the DB.
 * Revenue is *estimated* from used promos × pricing tiers, since there's
 * no orders table yet. Once Kaspi/card checkout is integrated, replace
 * the estimate with real order amounts.
 *
 * All heavy aggregation is pushed to SQL so the dashboard stays fast
 * even when the tables grow to hundreds of thousands of rows. The only
 * rows fully pulled into JS are used-promo records (for revenue estimate
 * — tiny set) and the top-10 users (hard-capped by LIMIT).
 */
export async function getAdminStats() {
  if (!(await isAdmin())) {
    return { success: false as const, error: "Access Denied" };
  }

  try {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const todayStart = new Date(now - DAY);
    const weekStart = new Date(now - 7 * DAY);
    const monthStart = new Date(now - 30 * DAY);

    // ---- All aggregate queries fire in parallel ----
    const [
      userCounts,
      bannedRow,
      genCounts,
      activeCounts,
      apiCostAll,
      apiCostToday,
      apiCostWeek,
      apiCostMonth,
      userSparkline,
      genSparkline,
      topUsersRows,
      usedPromosAll,
    ] = await Promise.all([
      // Users: total + today + week + month (via FILTER)
      db.select({
        total: sql<number>`count(*)::int`,
        today: sql<number>`count(*) filter (where ${users.createdAt} >= ${todayStart})::int`,
        week: sql<number>`count(*) filter (where ${users.createdAt} >= ${weekStart})::int`,
        month: sql<number>`count(*) filter (where ${users.createdAt} >= ${monthStart})::int`,
      }).from(users),
      db.select({ c: sql<number>`count(*)::int` })
        .from(users)
        .where(eq(users.isBanned, true)),
      // Generations: total + today + week + month
      db.select({
        total: sql<number>`count(*)::int`,
        today: sql<number>`count(*) filter (where ${creatives.createdAt} >= ${todayStart})::int`,
        week: sql<number>`count(*) filter (where ${creatives.createdAt} >= ${weekStart})::int`,
        month: sql<number>`count(*) filter (where ${creatives.createdAt} >= ${monthStart})::int`,
      }).from(creatives),
      // Active users: distinct userId in last 7d / 30d
      db.select({
        active7d: sql<number>`count(distinct ${creatives.userId}) filter (where ${creatives.createdAt} >= ${weekStart})::int`,
        active30d: sql<number>`count(distinct ${creatives.userId}) filter (where ${creatives.createdAt} >= ${monthStart})::int`,
      }).from(creatives),
      // API cost sums
      db.select({ s: sql<number>`coalesce(sum(${creatives.apiCostKzt}), 0)::float` }).from(creatives),
      db.select({ s: sql<number>`coalesce(sum(${creatives.apiCostKzt}), 0)::float` })
        .from(creatives)
        .where(gte(creatives.createdAt, todayStart)),
      db.select({ s: sql<number>`coalesce(sum(${creatives.apiCostKzt}), 0)::float` })
        .from(creatives)
        .where(gte(creatives.createdAt, weekStart)),
      db.select({ s: sql<number>`coalesce(sum(${creatives.apiCostKzt}), 0)::float` })
        .from(creatives)
        .where(gte(creatives.createdAt, monthStart)),
      // 14-day sparkline: one row per day
      db.select({
        day: sql<string>`to_char(date_trunc('day', ${users.createdAt}), 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
        .from(users)
        .where(gte(users.createdAt, new Date(now - 14 * DAY)))
        .groupBy(sql`date_trunc('day', ${users.createdAt})`),
      db.select({
        day: sql<string>`to_char(date_trunc('day', ${creatives.createdAt}), 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
        apiCostKzt: sql<number>`coalesce(sum(${creatives.apiCostKzt}), 0)::float`,
      })
        .from(creatives)
        .where(gte(creatives.createdAt, new Date(now - 14 * DAY)))
        .groupBy(sql`date_trunc('day', ${creatives.createdAt})`),
      // Top-10 users by generation count. Join with users to get email.
      db.select({
        id: users.id,
        email: users.email,
        impulses: users.impulses,
        gens: sql<number>`count(${creatives.id})::int`,
        apiCostKzt: sql<number>`coalesce(sum(${creatives.apiCostKzt}), 0)::float`,
      })
        .from(users)
        .leftJoin(creatives, eq(creatives.userId, users.id))
        .groupBy(users.id, users.email, users.impulses)
        .orderBy(sql`count(${creatives.id}) desc`)
        .limit(10),
      // Used promos — small table, full load is fine (only when isUsed=true)
      db.select().from(promoCodes).where(eq(promoCodes.isUsed, true)),
    ]);

    const usersRow = userCounts[0] ?? { total: 0, today: 0, week: 0, month: 0 };
    const gensRow = genCounts[0] ?? { total: 0, today: 0, week: 0, month: 0 };
    const activeRow = activeCounts[0] ?? { active7d: 0, active30d: 0 };
    const usersBanned = bannedRow[0]?.c ?? 0;
    const apiCostTotal = apiCostAll[0]?.s ?? 0;

    // ---- Revenue estimate from used promos (tiny set, done in JS) ----
    const inRange = (d: Date | null, from: Date) => d !== null && d.getTime() >= from.getTime();
    const revenueTotal = usedPromosAll.reduce((s, p) => s + estimateRevenueKztFromImpulses(p.impulses), 0);
    const revenueWeek = usedPromosAll
      .filter(p => inRange(p.usedAt, weekStart))
      .reduce((s, p) => s + estimateRevenueKztFromImpulses(p.impulses), 0);
    const revenueMonth = usedPromosAll
      .filter(p => inRange(p.usedAt, monthStart))
      .reduce((s, p) => s + estimateRevenueKztFromImpulses(p.impulses), 0);
    const payingUserIds = new Set(usedPromosAll.map(p => p.usedBy).filter(Boolean));
    const arpu = payingUserIds.size > 0 ? revenueTotal / payingUserIds.size : 0;

    // ---- 14-day sparkline: fill in zero-days so the chart is continuous ----
    const userByDay = new Map(userSparkline.map(r => [r.day, r.count]));
    const genByDay = new Map(genSparkline.map(r => [r.day, { count: r.count, apiCostKzt: r.apiCostKzt }]));
    const dailySeries: { date: string; users: number; gens: number; apiCostKzt: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const dayStart = new Date(now - i * DAY);
      dayStart.setHours(0, 0, 0, 0);
      const key = dayStart.toISOString().slice(0, 10);
      const gen = genByDay.get(key);
      dailySeries.push({
        date: key,
        users: userByDay.get(key) ?? 0,
        gens: gen?.count ?? 0,
        apiCostKzt: gen?.apiCostKzt ?? 0,
      });
    }

    return {
      success: true as const,
      generatedAt: new Date().toISOString(),
      users: {
        total: usersRow.total,
        today: usersRow.today,
        week: usersRow.week,
        month: usersRow.month,
        banned: usersBanned,
        active7d: activeRow.active7d,
        active30d: activeRow.active30d,
        paying: payingUserIds.size,
      },
      generations: {
        total: gensRow.total,
        today: gensRow.today,
        week: gensRow.week,
        month: gensRow.month,
        perUserAvg: usersRow.total > 0 ? gensRow.total / usersRow.total : 0,
      },
      apiCostsKzt: {
        total: apiCostTotal,
        today: apiCostToday[0]?.s ?? 0,
        week: apiCostWeek[0]?.s ?? 0,
        month: apiCostMonth[0]?.s ?? 0,
        perGenAvg: gensRow.total > 0 ? apiCostTotal / gensRow.total : 0,
      },
      revenueKztEstimate: {
        total: revenueTotal,
        week: revenueWeek,
        month: revenueMonth,
        arpu,
        avgKztPerImpulse: avgKztPerImpulse(),
        disclaimer: "Оценка: построена по использованным промокодам × ценам тарифов. Подключите orders-таблицу для точного дохода.",
      },
      dailySeries,
      topUsers: topUsersRows,
    };
  } catch (e: any) {
    return { success: false as const, error: e.message };
  }
}

export async function createPromoCode(impulses: number) {
  if (!(await isAdmin())) {
    return { success: false, error: "Access Denied" };
  }

  // Validation
  if (!Number.isInteger(impulses)) {
    return { success: false, error: "Количество импульсов должно быть целым числом." };
  }
  if (impulses < MIN_PROMO_IMPULSES || impulses > MAX_PROMO_IMPULSES) {
    return { success: false, error: `Импульсов должно быть от ${MIN_PROMO_IMPULSES} до ${MAX_PROMO_IMPULSES}.` };
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

    await recordAdminAction({
      action: "create_promo",
      targetType: "promo",
      targetId: code,
      meta: { impulses },
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

  if (typeof code !== "string" || code.trim().length === 0) {
    return { success: false, error: "Неверный код." };
  }

  try {
    await db.delete(promoCodes).where(eq(promoCodes.code, code));

    await recordAdminAction({
      action: "delete_promo",
      targetType: "promo",
      targetId: code,
    });

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

  // ---- Validation ----
  if (typeof userId !== "string" || userId.trim().length === 0) {
    return { success: false, error: "Неверный userId." };
  }
  if (typeof newBalance !== "number" || !Number.isFinite(newBalance)) {
    return { success: false, error: "Баланс должен быть числом." };
  }
  if (!Number.isInteger(newBalance)) {
    return { success: false, error: "Баланс должен быть целым числом." };
  }
  if (newBalance < MIN_BALANCE) {
    return { success: false, error: `Баланс не может быть отрицательным (мин. ${MIN_BALANCE}).` };
  }
  if (newBalance > MAX_BALANCE) {
    return { success: false, error: `Баланс слишком большой (макс. ${MAX_BALANCE}). Если нужно больше — свяжись с разработчиком.` };
  }

  try {
    // Fetch old balance for audit log
    const existingUser = await db.query.users.findFirst({ where: eq(users.id, userId) });
    const oldBalance = existingUser?.impulses ?? null;

    if (existingUser) {
      await db.update(users)
        .set({ impulses: newBalance })
        .where(eq(users.id, userId));
    } else {
      // Create lazily if they somehow don't exist yet but appear in some UI
      await db.insert(users).values({
        id: userId,
        email: "unknown/lazy-created@aicreative.kz",
        impulses: newBalance
      });
    }

    await recordAdminAction({
      action: "update_balance",
      targetType: "user",
      targetId: userId,
      meta: { oldBalance, newBalance, delta: oldBalance !== null ? newBalance - oldBalance : null },
    });

    return { success: true };
  } catch (e: any) {
    console.error("Error updating user balances:", e);
    return { success: false, error: e.message };
  }
}

export async function toggleUserBan(userId: string, isBanned: boolean) {
  if (!(await isAdmin())) {
    return { success: false, error: "Access Denied" };
  }

  if (typeof userId !== "string" || userId.trim().length === 0) {
    return { success: false, error: "Неверный userId." };
  }
  if (typeof isBanned !== "boolean") {
    return { success: false, error: "isBanned должен быть boolean." };
  }

  try {
    await db.update(users)
      .set({ isBanned })
      .where(eq(users.id, userId));

    await recordAdminAction({
      action: "toggle_ban",
      targetType: "user",
      targetId: userId,
      meta: { isBanned },
    });

    return { success: true };
  } catch (e: any) {
    console.error("Error toggling user ban:", e);
    return { success: false, error: e.message };
  }
}

/**
 * Paginated history for a single user. The modal in /admin previews each
 * creative inside an <iframe>, and every iframe re-parses an entire HTML
 * document — so loading a power user's 1000+ generations at once would
 * freeze the browser. We cap at HISTORY_PAGE_SIZE per fetch and the UI
 * shows a "Показать ещё" button when hasMore is true.
 */
const HISTORY_PAGE_SIZE_DEFAULT = 50;
const HISTORY_PAGE_SIZE_MAX = 200;

export async function getUserHistory(
  userId: string,
  limit: number = HISTORY_PAGE_SIZE_DEFAULT,
  offset: number = 0,
) {
  if (!(await isAdmin())) {
    return { success: false as const, error: "Access Denied" };
  }

  const safeLimit = Math.min(HISTORY_PAGE_SIZE_MAX, Math.max(1, Math.floor(limit)));
  const safeOffset = Math.max(0, Math.floor(offset));

  try {
    // Admin panel ALWAYS includes soft-deleted rows — that's the point.
    // UI marks them visually (see Admin history modal: deletedAt is surfaced
    // as `item.deletedAt` and rendered with a red "Удалено" badge).
    const [history, totalRows, liveRows] = await Promise.all([
      db.select()
        .from(creatives)
        .where(eq(creatives.userId, userId))
        .orderBy(desc(creatives.createdAt))
        .limit(safeLimit)
        .offset(safeOffset),
      db.select({ c: sql<number>`count(*)::int` })
        .from(creatives)
        .where(eq(creatives.userId, userId)),
      db.select({ c: sql<number>`count(*)::int` })
        .from(creatives)
        .where(and(eq(creatives.userId, userId), sql`${creatives.deletedAt} IS NULL`)),
    ]);

    const totalCount = totalRows[0]?.c ?? 0;
    const activeCount = liveRows[0]?.c ?? 0;
    const deletedCount = Math.max(0, totalCount - activeCount);
    const hasMore = safeOffset + history.length < totalCount;

    return {
      success: true as const,
      history,
      totalCount,
      activeCount,
      deletedCount,
      hasMore,
      offset: safeOffset,
      limit: safeLimit,
    };
  } catch (e: any) {
    console.error("Error fetching user history:", e);
    return { success: false as const, error: e.message };
  }
}

/**
 * Return the last N admin actions for the audit-log UI.
 */
export async function getAdminAuditLog(limit = 100) {
  if (!(await isAdmin())) {
    return { success: false as const, error: "Access Denied" };
  }
  try {
    const rows = await getRecentAuditLog(limit);
    return { success: true as const, rows };
  } catch (e: any) {
    return { success: false as const, error: e.message };
  }
}

/**
 * Return the audit trail for a single user (all balance changes, bans).
 */
export async function getUserAuditLog(userId: string, limit = 50) {
  if (!(await isAdmin())) {
    return { success: false as const, error: "Access Denied" };
  }
  try {
    const rows = await getAuditLogForUser(userId, limit);
    return { success: true as const, rows };
  } catch (e: any) {
    return { success: false as const, error: e.message };
  }
}

/**
 * Resolve a downloadable target for an arbitrary creative (any user's).
 *
 * Usage from the admin panel: admin views a user's creative-history modal,
 * clicks "Скачать" on a row. This action returns a `downloadUrl` the client
 * can <a href=""> or trigger — either a direct GCS mp4 link, or a blob-url
 * built from the raw htmlCode so admin gets the source as a fallback.
 *
 * Every hit is written to the audit log so we can trace which admin pulled
 * which customer's file and when.
 */
export async function adminDownloadCreative(creativeId: string) {
  if (!(await isAdmin())) {
    return { success: false as const, error: "Access Denied" };
  }
  if (typeof creativeId !== "string" || creativeId.trim().length === 0) {
    return { success: false as const, error: "Неверный id креатива." };
  }

  try {
    const row = await db.query.creatives.findFirst({
      where: eq(creatives.id, creativeId),
    });
    if (!row) {
      return { success: false as const, error: "Креатив не найден." };
    }

    const v = row.videoUrl ?? "";

    // Audit every download attempt — success or not.
    await recordAdminAction({
      action: "admin_download_creative",
      targetType: "creative",
      targetId: creativeId,
      meta: { ownerUserId: row.userId, format: row.format, videoStatus: v.split(":")[0] || "none" },
    }).catch(() => undefined);

    // Case 1: video is ready — admin just downloads the MP4 directly.
    if (v.startsWith("http://") || v.startsWith("https://")) {
      return {
        success: true as const,
        kind: "video" as const,
        url: v,
        filename: `creative_${creativeId}.mp4`,
      };
    }

    // Case 2: video failed / cancelled.
    if (v.startsWith("failed:")) {
      return {
        success: false as const,
        error: `Рендер этого креатива помечен как failed: ${v.slice("failed:".length)}`,
      };
    }

    // Case 3: video still rendering. Admin can download the source HTML
    // for debugging meanwhile.
    if (v.startsWith("rendering:")) {
      if (!row.htmlCode) {
        return { success: false as const, error: "Рендер ещё идёт, исходный HTML недоступен." };
      }
      return {
        success: true as const,
        kind: "html" as const,
        html: row.htmlCode,
        filename: `creative_${creativeId}_source.html`,
        warning: "Видео ещё рендерится — скачан исходный HTML для отладки.",
      };
    }

    // Case 4: never-rendered creative (static) — give the HTML so admin can
    // open it in a browser and screenshot / repurpose.
    if (row.htmlCode) {
      return {
        success: true as const,
        kind: "html" as const,
        html: row.htmlCode,
        filename: `creative_${creativeId}.html`,
      };
    }

    return { success: false as const, error: "Ни видео, ни HTML у этого креатива нет." };
  } catch (e: any) {
    console.error("adminDownloadCreative error:", e);
    return { success: false as const, error: e.message };
  }
}

/**
 * Admin impersonation via Clerk sign-in tokens.
 *
 * Flow:
 *   1. Admin clicks "Войти как <email>" in the CRM row.
 *   2. We call Clerk's backend API to create a one-time sign-in ticket
 *      scoped to the target user.
 *   3. We return the ticket URL; the client-side redirects admin to it.
 *   4. Clerk silently swaps the session: admin is now signed in AS the
 *      target user (single-session mode, the admin's previous session is
 *      replaced).
 *   5. A persistent banner (see ImpersonationBanner component) appears on
 *      every page while this cookie is set, offering "Выйти и вернуться
 *      к админке" — which signs out and lands back on the landing.
 *
 * Security:
 *   - Only admins (ADMIN_EMAILS) can trigger this.
 *   - The audit log records who impersonated whom and when.
 *   - We DO NOT persist the real admin's identity in a cookie in plain
 *     text — the banner just asks the admin to re-sign-in after they're
 *     done. This avoids accidental privilege preservation.
 */
export async function adminImpersonateUser(targetUserId: string) {
  if (!(await isAdmin())) {
    return { success: false as const, error: "Access Denied" };
  }
  if (typeof targetUserId !== "string" || targetUserId.trim().length === 0) {
    return { success: false as const, error: "Неверный userId." };
  }

  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) {
    return {
      success: false as const,
      error: "CLERK_SECRET_KEY не настроен на сервере.",
    };
  }

  try {
    // Fetch target's email for the audit log + pretty banner label.
    const target = await db.query.users.findFirst({ where: eq(users.id, targetUserId) });

    // Clerk Backend API: create a sign-in token valid for a single use.
    // docs: https://clerk.com/docs/reference/backend-api/tag/Sign-In-Tokens
    const resp = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: targetUserId,
        // 15 minutes — plenty of time for admin to click through.
        expires_in_seconds: 900,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return {
        success: false as const,
        error: `Clerk вернул ${resp.status}: ${text.slice(0, 300)}`,
      };
    }

    const data = (await resp.json()) as { token?: string; url?: string; id?: string };
    if (!data.token) {
      return { success: false as const, error: "Clerk не вернул token." };
    }

    // Build the ticket-consumption URL Clerk expects:
    //
    //   https://<ACCOUNTS_PORTAL>/sign-in?__clerk_ticket=<TOKEN>&redirect_url=<RETURN_URL>
    //
    // The accounts portal is the public domain where Clerk hosts the
    // sign-in UI. On dev it's `immense-leech-25.accounts.dev`, on prod it
    // will be e.g. `accounts.aicreative.kz`. We derive the domain by
    // decoding the publishable key (its payload is "<frontend-api>$"
    // base64), then trim the leading "clerk." to get the accounts portal.
    //
    // `redirect_url` must be an ABSOLUTE URL because Clerk's portal lives
    // on a different origin than our app.
    const pubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    if (!pubKey) {
      return { success: false as const, error: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY не настроен." };
    }

    let accountsPortalOrigin = "";
    try {
      const payload = pubKey.replace(/^pk_(test|live)_/, "");
      const frontendApi = Buffer.from(payload, "base64").toString("utf-8").replace(/\$+$/, "").trim();
      // frontendApi like "immense-leech-25.clerk.accounts.dev"
      //              or "clerk.aicreative.kz"
      const accountsDomain = frontendApi.replace(/^clerk\./, "");
      accountsPortalOrigin = `https://${accountsDomain}`;
    } catch {
      return { success: false as const, error: "Не удалось декодировать Clerk publishable key." };
    }

    // Absolute return URL back to our own app.
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";
    const returnUrl = `${siteUrl.replace(/\/$/, "")}/editor?impersonating=1`;

    const consumeUrl =
      `${accountsPortalOrigin}/sign-in?__clerk_ticket=${encodeURIComponent(data.token)}` +
      `&redirect_url=${encodeURIComponent(returnUrl)}`;

    await recordAdminAction({
      action: "impersonate_user",
      targetType: "user",
      targetId: targetUserId,
      meta: { targetEmail: target?.email ?? null, tokenId: data.id ?? null },
    }).catch(() => undefined);

    return {
      success: true as const,
      url: consumeUrl,
      targetEmail: target?.email ?? null,
    };
  } catch (e: any) {
    console.error("adminImpersonateUser error:", e);
    return { success: false as const, error: e.message };
  }
}

/**
 * Pull every Clerk user into our DB. Idempotent — uses ON CONFLICT DO
 * NOTHING so existing rows are left alone. Useful when the webhook was
 * misconfigured for a window of time and signups landed in Clerk but
 * not in our DB.
 *
 * Runs against whatever Clerk instance the deployment is bound to (so
 * on prod it pulls prod users, on preview it pulls test users — both
 * via the env's CLERK_SECRET_KEY).
 */
export async function adminSyncClerkUsers() {
  if (!(await isAdmin())) {
    return { success: false as const, error: "Access Denied" };
  }
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) {
    return { success: false as const, error: "CLERK_SECRET_KEY is not set" };
  }

  try {
    // Page through Clerk's /v1/users — limit 100 is the max they allow.
    const all: any[] = [];
    let offset = 0;
    while (true) {
      const r = await fetch(
        `https://api.clerk.com/v1/users?limit=100&offset=${offset}`,
        { headers: { Authorization: `Bearer ${secret}` } },
      );
      if (!r.ok) {
        const text = await r.text().catch(() => "");
        return {
          success: false as const,
          error: `Clerk API ${r.status}: ${text.slice(0, 300)}`,
        };
      }
      const arr = await r.json();
      if (!Array.isArray(arr) || arr.length === 0) break;
      all.push(...arr);
      if (arr.length < 100) break;
      offset += 100;
    }

    const insertedList: { id: string; email: string; name: string }[] = [];
    for (const cu of all) {
      const email = cu?.email_addresses?.[0]?.email_address;
      if (!email) continue;
      const name =
        [cu.first_name, cu.last_name].filter(Boolean).join(" ") ||
        cu.username ||
        email.split("@")[0];
      const created = cu.created_at
        ? new Date(cu.created_at)
        : new Date();
      const result = await db
        .insert(users)
        .values({
          id: cu.id,
          email,
          name,
          image: cu.image_url || "",
          impulses: SIGNUP_BONUS_IMPULSES,
          welcomeShown: false,
          createdAt: created,
        })
        .onConflictDoNothing({ target: users.id })
        .returning({ id: users.id });
      if (result.length > 0) insertedList.push({ id: cu.id, email, name });
    }

    await recordAdminAction({
      action: "sync_clerk_users",
      meta: { totalClerk: all.length, inserted: insertedList.length },
    }).catch(() => undefined);

    return {
      success: true as const,
      totalClerk: all.length,
      inserted: insertedList.length,
      list: insertedList,
    };
  } catch (e: any) {
    console.error("adminSyncClerkUsers error:", e);
    return { success: false as const, error: e.message };
  }
}
