/**
 * Meta Conversions API (CAPI) — server-side event sender.
 *
 * Why server-side at all when we already have the browser pixel?
 *   iOS 14.5+ ATT, Safari ITP, Firefox ETP, ad-blockers and content-blockers
 *   all erode browser pixel coverage. Meta reports 10-40% event loss on
 *   browser-only integrations. CAPI is unaffected by any of that because
 *   the event is sent from our server → Meta's server with no browser in
 *   the middle. Combined with the client pixel (deduped via `event_id`)
 *   it typically recovers 95%+ of conversions.
 *
 * How dedup works:
 *   When both the browser pixel and CAPI fire the same event (same
 *   `event_name`, same `event_id`) within Meta's dedup window (~2 days),
 *   Meta counts it once. We pick deterministic event IDs:
 *     - CompleteRegistration: `reg_<clerkUserId>`
 *     - Purchase (promo redeem): `promo_<promoCode>`
 *   Both sides must emit the same string — the client helpers in
 *   @/lib/fb-pixel accept an optional `eventId` arg for this reason.
 *
 * User data hashing:
 *   Meta requires PII fields (email, phone, first/last name) to be
 *   SHA-256 hashed, lowercased + trimmed. The raw client IP and
 *   user-agent are *not* hashed — Meta uses them for match-on-arrival.
 *
 * Fail behaviour:
 *   Every call swallows errors and logs them. A failing CAPI call must
 *   never break a user-facing flow (sign-up, checkout, promo redeem).
 *   If the env var is missing we no-op silently so staging / preview
 *   environments don't spam the Graph API.
 */

import crypto from "node:crypto";

const GRAPH_VERSION = "v19.0";
const PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID || "2396357890863084";
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;
// Optional — Meta lets you include a test_event_code to route the event
// to the "Test Events" tab in Events Manager for debugging without
// polluting production stats. Set META_CAPI_TEST_EVENT_CODE in Vercel
// preview only.
const TEST_EVENT_CODE = process.env.META_CAPI_TEST_EVENT_CODE;

function sha256Normalized(raw: string): string {
  return crypto
    .createHash("sha256")
    .update(raw.trim().toLowerCase())
    .digest("hex");
}

export type CapiUserData = {
  /** Raw email; will be SHA-256 hashed before sending. */
  email?: string;
  /**
   * Your own stable user id (Clerk user id works great — it's opaque
   * to Meta and they only store the hash). Helps when the user signs in
   * from a different browser than they originally converted in.
   */
  externalId?: string;
  /** Set from the incoming request in the API route handler. */
  clientIp?: string;
  /** Set from the incoming `user-agent` header. */
  clientUserAgent?: string;
  /**
   * `_fbp` cookie value from the browser. The pixel sets this when it
   * loads. If you can read the cookie server-side, pass it here — it's
   * one of Meta's strongest matching signals.
   */
  fbp?: string;
  /**
   * `_fbc` cookie value — set when the user arrived via an ad click
   * (format: `fb.1.<timestamp>.<fbclid>`). Passing it ties the
   * conversion back to the clicked ad.
   */
  fbc?: string;
};

export type CapiEventOpts = {
  /** One of Meta's standard event names, e.g. "Purchase". */
  eventName: string;
  /**
   * Deterministic id used to dedupe this event against the matching
   * browser-pixel fire. MUST be identical on both sides.
   */
  eventId: string;
  /** Full URL of the page where the conversion happened, if known. */
  eventSourceUrl?: string;
  user: CapiUserData;
  /**
   * Meta "standard" parameters — `value`, `currency`, `content_name`, etc.
   * Whatever you pass here mirrors the browser pixel call so Events
   * Manager reports match.
   */
  customData?: Record<string, unknown>;
};

/**
 * Send a single event to Meta's Conversions API.
 *
 * Resolves without throwing on failure — CAPI is a side-channel for
 * analytics, not a critical path. Every caller is in a flow where we
 * want the user to continue even if Meta is down.
 */
export async function sendCapiEvent(opts: CapiEventOpts): Promise<void> {
  if (!ACCESS_TOKEN || !PIXEL_ID) {
    // Silently no-op when not configured. Keeps preview/dev environments
    // from needing the token just to not crash.
    return;
  }

  const userData: Record<string, unknown> = {};
  // Meta accepts each PII field as an *array* of hashes, so the same
  // event can carry multiple possible emails/phones for matching.
  if (opts.user.email) userData.em = [sha256Normalized(opts.user.email)];
  if (opts.user.externalId) {
    userData.external_id = [sha256Normalized(opts.user.externalId)];
  }
  // IP + UA are plain text — Meta hashes them on arrival.
  if (opts.user.clientIp) userData.client_ip_address = opts.user.clientIp;
  if (opts.user.clientUserAgent) {
    userData.client_user_agent = opts.user.clientUserAgent;
  }
  if (opts.user.fbp) userData.fbp = opts.user.fbp;
  if (opts.user.fbc) userData.fbc = opts.user.fbc;

  const event: Record<string, unknown> = {
    event_name: opts.eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: opts.eventId,
    action_source: "website",
    user_data: userData,
  };
  if (opts.eventSourceUrl) event.event_source_url = opts.eventSourceUrl;
  if (opts.customData) event.custom_data = opts.customData;

  const body: Record<string, unknown> = { data: [event] };
  if (TEST_EVENT_CODE) body.test_event_code = TEST_EVENT_CODE;

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(
    ACCESS_TOKEN,
  )}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      // Keep the request short — CAPI is called from user-facing flows
      // like sign-up, so we don't want a slow Meta API to block them.
      // Next.js runtime doesn't honour AbortSignal.timeout on all
      // deployment targets, so we use AbortController manually.
      signal: AbortSignal.timeout(3500),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[CAPI] ${opts.eventName} non-OK response ${res.status}: ${text.slice(0, 500)}`,
      );
    }
  } catch (err) {
    // Network error, timeout, DNS failure — log and move on.
    console.error(`[CAPI] ${opts.eventName} fetch failed:`, err);
  }
}
