/**
 * In-memory rate limiter for product-generation endpoints (sites,
 * presentations, products). Covers v1 while these endpoints don't
 * persist to the `creatives` table — once we add DB persistence we can
 * fold them into the existing checkGenerateRateLimit which queries the
 * creatives count.
 *
 * Per-process Map<userId, timestamps[]>. Resets on dev restart / Vercel
 * cold start. Good enough to stop bot-fanout against a single process;
 * for production with multi-instance Vercel we'll need Redis.
 *
 * Limits intentionally tighter than /api/generate (which has 5/min,
 * 25/hr) since these endpoints are more expensive (Claude + N image
 * gens per call).
 */

const BURST_WINDOW_MS = 60 * 1000; // 60 sec
const BURST_LIMIT = 3; // 3 generations per minute
const HOURLY_WINDOW_MS = 60 * 60 * 1000;
const HOURLY_LIMIT = 12; // 12 generations per hour

declare global {
  // eslint-disable-next-line no-var
  var __aicreativeProductsRateLimit: Map<string, number[]> | undefined;
}

function getStore(): Map<string, number[]> {
  if (!globalThis.__aicreativeProductsRateLimit) {
    globalThis.__aicreativeProductsRateLimit = new Map();
  }
  return globalThis.__aicreativeProductsRateLimit;
}

export type ProductsRateLimitResult =
  | { ok: true }
  | { ok: false; reason: "burst" | "hourly"; retryAfterSec: number };

/**
 * Returns ok:false if user has hit the burst (3/min) or hourly (12/hr)
 * limit. Caller should bail with a 429 + retryAfter; on ok:true the
 * timestamp is recorded so the next call sees the increment.
 */
export function checkProductsRateLimit(userId: string): ProductsRateLimitResult {
  const store = getStore();
  const now = Date.now();
  const timestamps = store.get(userId) ?? [];

  // Drop stale entries beyond the hourly window.
  const fresh = timestamps.filter((t) => now - t < HOURLY_WINDOW_MS);
  const burstCount = fresh.filter((t) => now - t < BURST_WINDOW_MS).length;

  if (burstCount >= BURST_LIMIT) {
    return {
      ok: false,
      reason: "burst",
      retryAfterSec: Math.ceil(BURST_WINDOW_MS / 1000),
    };
  }
  if (fresh.length >= HOURLY_LIMIT) {
    return {
      ok: false,
      reason: "hourly",
      retryAfterSec: Math.ceil(HOURLY_WINDOW_MS / 1000),
    };
  }

  fresh.push(now);
  store.set(userId, fresh);
  return { ok: true };
}

export function rateLimitMessage(r: Extract<ProductsRateLimitResult, { ok: false }>): string {
  if (r.reason === "burst") {
    return `Слишком быстро — попробуй через ${r.retryAfterSec} сек.`;
  }
  return "Часовой лимит исчерпан — попробуй через час.";
}
