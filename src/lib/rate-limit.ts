import { db } from "@/db";
import { creatives } from "@/db/schema";
import { and, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";

/**
 * Rate limits.
 *
 * Source of truth = `creatives` table. Every generation/refine is logged
 * with `createdAt`, so we count rows in a sliding window — no separate
 * counter table or Redis needed.
 *
 * Two endpoints, two budgets:
 *
 *   /api/generate (dual-model: Claude + Gemini per click):
 *     - BURST:   max 5 clicks per 60 sec (anti-spam)
 *     - HOURLY:  max 25 clicks per hour
 *     A "click" can produce 1 or 2 rows (depending on which model succeeded);
 *     we count distinct generation EVENTS by deduping rows on `pair_id`.
 *
 *   /api/refine (vision-loop):
 *     - HOURLY:  max 20 refines per hour
 *     Counted by `parent_creative_id IS NOT NULL`.
 *
 * Admins bypass rate limits via `isAdmin()` at the call site.
 */

const BURST_LIMIT = 5;
const BURST_WINDOW_SEC = 60;

const HOURLY_LIMIT = 25;
const HOURLY_WINDOW_SEC = 60 * 60;

const REFINE_HOURLY_LIMIT = 20;

export type RateLimitResult =
  | { ok: true }
  | {
      ok: false;
      reason: "burst" | "hourly";
      limit: number;
      windowSec: number;
      retryAfterSec: number;
    };

/**
 * Count distinct generation EVENTS (not rows) by the user since `sinceDate`.
 * One dual-model click = 1 event regardless of how many rows it created.
 * Refines (parent_creative_id IS NOT NULL) are excluded — they have their
 * own bucket via `countRefinesSince`.
 */
async function countGenerationsSince(userId: string, sinceDate: Date): Promise<number> {
  const rows = await db
    .select({
      c: sql<number>`count(distinct coalesce(${creatives.pairId}, ${creatives.id}))::int`,
    })
    .from(creatives)
    .where(
      and(
        eq(creatives.userId, userId),
        gte(creatives.createdAt, sinceDate),
        isNull(creatives.parentCreativeId),
      ),
    );
  return rows[0]?.c ?? 0;
}

async function countRefinesSince(userId: string, sinceDate: Date): Promise<number> {
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(creatives)
    .where(
      and(
        eq(creatives.userId, userId),
        gte(creatives.createdAt, sinceDate),
        isNotNull(creatives.parentCreativeId),
      ),
    );
  return rows[0]?.c ?? 0;
}

export async function checkGenerateRateLimit(
  userId: string,
): Promise<RateLimitResult> {
  const now = Date.now();

  const burstSince = new Date(now - BURST_WINDOW_SEC * 1000);
  const burstCount = await countGenerationsSince(userId, burstSince);
  if (burstCount >= BURST_LIMIT) {
    return {
      ok: false,
      reason: "burst",
      limit: BURST_LIMIT,
      windowSec: BURST_WINDOW_SEC,
      retryAfterSec: BURST_WINDOW_SEC,
    };
  }

  const hourlySince = new Date(now - HOURLY_WINDOW_SEC * 1000);
  const hourlyCount = await countGenerationsSince(userId, hourlySince);
  if (hourlyCount >= HOURLY_LIMIT) {
    return {
      ok: false,
      reason: "hourly",
      limit: HOURLY_LIMIT,
      windowSec: HOURLY_WINDOW_SEC,
      retryAfterSec: HOURLY_WINDOW_SEC,
    };
  }

  return { ok: true };
}

export async function checkRefineRateLimit(
  userId: string,
): Promise<RateLimitResult> {
  const now = Date.now();
  const since = new Date(now - HOURLY_WINDOW_SEC * 1000);
  const count = await countRefinesSince(userId, since);
  if (count >= REFINE_HOURLY_LIMIT) {
    return {
      ok: false,
      reason: "hourly",
      limit: REFINE_HOURLY_LIMIT,
      windowSec: HOURLY_WINDOW_SEC,
      retryAfterSec: HOURLY_WINDOW_SEC,
    };
  }
  return { ok: true };
}

export function rateLimitMessage(r: Extract<RateLimitResult, { ok: false }>): string {
  if (r.reason === "burst") {
    return `Слишком много генераций за раз. Подожди ~${Math.ceil(r.retryAfterSec / 60)} мин и попробуй снова.`;
  }
  return `Превышен часовой лимит (${r.limit}/час). Попробуй через час или напиши в поддержку, если нужно больше.`;
}
