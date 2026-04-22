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

/** Raw event-firing primitive.
 *
 * The optional `eventId` is what Meta uses to dedupe this browser-pixel
 * fire against the matching server-side CAPI fire (see @/lib/fb-capi).
 * Both sides MUST pass the same string for the same logical event.
 * When provided, it's forwarded as Meta's `eventID` option (note the
 * capital-D — that's their wire format). If omitted, the event is sent
 * standalone and de-duplication falls back to user/time-window matching
 * on Meta's end.
 */
export function trackFbEvent(
  event: string,
  params?: Record<string, unknown>,
  eventId?: string,
): void {
  if (typeof window === "undefined") return;
  const fbq = window.fbq;
  if (typeof fbq !== "function") return;
  try {
    const opts = eventId ? { eventID: eventId } : undefined;
    if (params && opts) fbq("track", event, params, opts);
    else if (params) fbq("track", event, params);
    else if (opts) fbq("track", event, {}, opts);
    else fbq("track", event);
  } catch {
    // Pixel errors should never break the app — swallow.
  }
}

/**
 * Fire CompleteRegistration. Called once per user after Clerk successfully
 * signs them up. Browser-side dedup (once per user-id in localStorage) is
 * handled in <RegistrationTracker />; cross-channel dedup with the CAPI
 * fire in the Clerk webhook is handled via a deterministic event id of
 * the form `reg_<clerkUserId>`.
 */
export function trackRegistration(opts?: {
  method?: "email" | "google" | "other";
  userId?: string;
}): void {
  const eventId = opts?.userId ? `reg_${opts.userId}` : undefined;
  trackFbEvent(
    "CompleteRegistration",
    {
      content_name: "AICreative account",
      status: "completed",
      ...(opts?.method ? { registration_method: opts.method } : {}),
    },
    eventId,
  );
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
  // Event id matches the server-side CAPI fire in `redeemPromoCode` so
  // Meta can dedupe browser + server events for the same redemption.
  // If the caller didn't pass a code we still emit the event, just
  // without cross-channel dedup (better than dropping the conversion).
  const eventId = opts.code ? `promo_${opts.code.trim().toUpperCase()}` : undefined;
  trackFbEvent(
    "Purchase",
    {
      value,
      currency: FB_CURRENCY,
      content_name: `+${opts.impulses} impulses`,
      content_ids: opts.code ? [opts.code] : [`promo_${opts.impulses}`],
      content_category: "promo_redemption",
      num_items: 1,
    },
    eventId,
  );
}
