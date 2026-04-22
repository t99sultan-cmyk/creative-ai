/**
 * Thin wrapper around `window.fbq` for Meta Pixel standard events.
 *
 * The base script is injected once in <MetaPixel /> from the app layout.
 * These helpers just forward calls to `window.fbq` with the correct
 * Meta "standard event" names + parameter shapes. See
 *   https://developers.facebook.com/docs/meta-pixel/reference#standard-events
 *
 * All calls are safe to invoke at any time:
 *   - SSR: `window` is undefined → no-op.
 *   - Client, before Meta's CDN script loads: the inline stub queues the
 *     call and replays it once fbevents.js is ready.
 *   - Pixel disabled via empty env var: `window.fbq` is never defined →
 *     this file silently skips.
 */

import { estimateRevenueKztFromImpulses } from "@/lib/pricing";

export const FB_CURRENCY = "KZT" as const;

/** Raw event-firing primitive. */
export function trackFbEvent(event: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const fbq = window.fbq;
  if (typeof fbq !== "function") return;
  try {
    if (params) fbq("track", event, params);
    else fbq("track", event);
  } catch {
    // Pixel errors should never break the app — swallow.
  }
}

/**
 * Fire CompleteRegistration. Called once per user after Clerk successfully
 * signs them up. De-duplication is handled in <RegistrationTracker />.
 */
export function trackRegistration(opts?: { method?: "email" | "google" | "other" }): void {
  trackFbEvent("CompleteRegistration", {
    content_name: "AICreative account",
    status: "completed",
    ...(opts?.method ? { registration_method: opts.method } : {}),
  });
}

/**
 * Fire InitiateCheckout when the user clicks a pricing button (before Clerk
 * modal opens for guests, or before /checkout navigation for signed-in).
 *
 * Meta's Events Manager uses `value` + `currency` for ROAS reports, so we
 * pass the tier's actual KZT price — not a placeholder.
 */
export function trackInitiateCheckout(tier: {
  name: string;
  priceKzt: number;
  impulses: number;
}): void {
  trackFbEvent("InitiateCheckout", {
    value: tier.priceKzt,
    currency: FB_CURRENCY,
    content_name: tier.name,
    content_ids: [tier.name],
    content_category: "subscription_tier",
    num_items: 1,
  });
}

/**
 * Fire Purchase when a promo code is successfully redeemed. In the current
 * flow this IS the conversion moment — user has paid Kaspi, manager sent
 * them a promo, they entered it and their balance was credited. We
 * back-compute the approximate KZT value from impulses using the same
 * pricing table the landing shows, so FB campaign ROAS numbers line up
 * with what the admin dashboard reports.
 */
export function trackPurchase(opts: { impulses: number; code?: string }): void {
  const value = estimateRevenueKztFromImpulses(opts.impulses);
  trackFbEvent("Purchase", {
    value,
    currency: FB_CURRENCY,
    content_name: `+${opts.impulses} impulses`,
    content_ids: opts.code ? [opts.code] : [`promo_${opts.impulses}`],
    content_category: "promo_redemption",
    num_items: 1,
  });
}
