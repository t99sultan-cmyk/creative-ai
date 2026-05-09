/**
 * Normalize a Kazakhstani phone number to E.164 format (+7XXXXXXXXXX).
 *
 * KZ phones are colloquially written as `8 707 ...` (the historical
 * domestic-prefix). Clerk and Twilio require E.164 (`+7 707 ...`).
 * This helper accepts both shapes plus any whitespace/dashes/parens
 * the user might paste, and emits the canonical form.
 *
 * Examples:
 *   "+7 707 123 45 67"  → "+77071234567"
 *   "8 (707) 123-45-67"  → "+77071234567"
 *   "87071234567"        → "+77071234567"
 *   "77071234567"        → "+77071234567"
 *   "707 123 4567"       → "+77071234567"  (assume KZ)
 *
 * Returns null if the input doesn't look like a valid 10-or-11 digit
 * phone number — caller should treat null as "show validation error".
 */
export function normalizeKzPhone(raw: string): string | null {
  if (!raw) return null;
  // Strip every non-digit character: spaces, dashes, parens, the leading +
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // Cases:
  //   11 digits starting with 7  → already E.164 minus the +
  //   11 digits starting with 8  → KZ domestic prefix, swap 8 → 7
  //   10 digits (no country code) → assume KZ, prepend 7
  if (digits.length === 11 && digits.startsWith("7")) {
    return `+${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("8")) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `+7${digits}`;
  }
  return null;
}

/**
 * Format a phone number for display while user is typing. Best-effort —
 * inserts spaces but tolerates partial input. Doesn't validate.
 *
 * Example progression as user types:
 *   "8"           → "8"
 *   "87"          → "8 7"
 *   "87071"       → "8 707 1"
 *   "870712345"   → "8 707 123 45"
 *   "87071234567" → "8 707 123 45 67"
 */
export function formatPhoneAsTyped(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  // Pattern: X XXX XXX XX XX (1 + 3 + 3 + 2 + 2 = 11)
  const parts: string[] = [];
  if (digits.length >= 1) parts.push(digits.slice(0, 1));
  if (digits.length >= 2) parts.push(digits.slice(1, 4));
  if (digits.length >= 5) parts.push(digits.slice(4, 7));
  if (digits.length >= 8) parts.push(digits.slice(7, 9));
  if (digits.length >= 10) parts.push(digits.slice(9, 11));
  return parts.join(" ");
}
