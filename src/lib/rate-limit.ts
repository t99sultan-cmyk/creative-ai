import { db } from "@/db";
import { creatives } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";

/**
 * Rate limit the /api/generate endpoint.
 *
 * Uses the `creatives` table as a source of truth — every successful
 * generation is already logged there with `createdAt`, so we can count
 * generations per user in a sliding window without a separate counter
 * table (and without Redis).
 *
 * Two tiers:
 *   - BURST: max 5 generations per 60 seconds (anti-spam)
 *   - HOURLY: max 50 generations per hour (anti-abuse / budget shield)
 *
 * Admins bypass rate limits.
 */

const BURST_LIMIT = 5;
const BURST_WINDOW_SEC = 60;

const HOURLY_LIMIT = 50;
const HOURLY_WINDOW_SEC = 60 * 60;

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
 * Count how many creatives a user has generated since `sinceDate`.
 * Uses a raw SQL count for efficiency.
 */
async function countSince(userId: string, sinceDate: Date): Promise<number> {
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(creatives)
    .where(and(eq(creatives.userId, userId), gte(creatives.createdAt, sinceDate)));
  return rows[0]?.c ?? 0;
}

export async function checkGenerateRateLimit(
  userId: string,
): Promise<RateLimitResult> {
  const now = Date.now();

  // Burst check first (cheapest, catches most abuse)
  const burstSince = new Date(now - BURST_WINDOW_SEC * 1000);
  const burstCount = await countSince(userId, burstSince);
  if (burstCount >= BURST_LIMIT) {
    return {
      ok: false,
      reason: "burst",
      limit: BURST_LIMIT,
      windowSec: BURST_WINDOW_SEC,
      retryAfterSec: BURST_WINDOW_SEC,
    };
  }

  // Hourly check
  const hourlySince = new Date(now - HOURLY_WINDOW_SEC * 1000);
  const hourlyCount = await countSince(userId, hourlySince);
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

/**
 * Human-readable message for the UI.
 */
export function rateLimitMessage(r: Extract<RateLimitResult, { ok: false }>): string {
  if (r.reason === "burst") {
    return `Слишком много генераций за раз. Подожди ~${Math.ceil(r.retryAfterSec / 60)} мин и попробуй снова.`;
  }
  return `Превышен часовой лимит (${r.limit}/час). Попробуй через час или напиши в поддержку, если нужно больше.`;
}
