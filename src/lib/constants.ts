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
  /** Telegram username, no @. Receives payment receipts and support
   *  questions. WhatsApp was dropped — Telegram is the only inbound
   *  channel now. */
  TG_USERNAME: "voise_kz",
} as const;
