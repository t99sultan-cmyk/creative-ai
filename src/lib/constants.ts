/**
 * App-wide constants that aren't tier/pricing data (for that see
 * @/lib/pricing). Single source of truth for things hardcoded in
 * multiple places.
 */

/**
 * Public support contacts shown to users on /onboarding (welcome
 * screen "получи поздравление" block) and /checkout (receipt-send
 * step). Update here only — both surfaces import this object.
 */
export const SUPPORT_CONTACTS = {
  /** WhatsApp number in E.164 format (no plus, no spaces). */
  WA_NUMBER_E164: "77765282788",
  /** Telegram username, no @. */
  TG_USERNAME: "ai_creativekz",
} as const;
