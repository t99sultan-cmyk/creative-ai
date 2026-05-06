import { currentUser } from "@clerk/nextjs/server";

/**
 * Admin email allowlist from env. Comma-separated, case-insensitive.
 * Example in .env.local:
 *   ADMIN_EMAILS=admin@aicreative.kz,timur@example.com
 *
 * Fail-closed: if ADMIN_EMAILS is not set, nobody is admin.
 */
export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const admins = getAdminEmails();
  if (admins.length === 0) return false;
  return admins.includes(email.toLowerCase());
}

/**
 * Returns true if the current Clerk-authenticated user has an email in the
 * ADMIN_EMAILS allowlist. Safe to call from server components, server actions,
 * and route handlers.
 */
export async function isAdmin(): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;
  const email = user.emailAddresses?.[0]?.emailAddress;
  return isAdminEmail(email);
}

/**
 * Curator allowlist from env. Same comma-separated case-insensitive
 * format as ADMIN_EMAILS. A curator is a trusted team member who can
 * manage users (give tokens, see all creatives, create creator-team
 * promo codes) but does NOT see financial analytics — API spend,
 * revenue estimates, profit margins.
 *
 * Example in .env.local:
 *   CURATOR_EMAILS=curator@aicreative.kz
 */
export function getCuratorEmails(): string[] {
  const raw = process.env.CURATOR_EMAILS || "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

export function isCuratorEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const curators = getCuratorEmails();
  if (curators.length === 0) return false;
  return curators.includes(email.toLowerCase());
}

/**
 * Returns true if the current user is in CURATOR_EMAILS. Admins are NOT
 * automatically curators (different concept) — but for layout / dashboard
 * gating you usually want isAdminOrCurator() below.
 */
export async function isCurator(): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;
  const email = user.emailAddresses?.[0]?.emailAddress;
  return isCuratorEmail(email);
}

/**
 * Combined gate for shared dashboard surfaces (curator can see what
 * admin sees, with cost/revenue redacted in the data layer).
 */
export async function isAdminOrCurator(): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;
  const email = user.emailAddresses?.[0]?.emailAddress;
  return isAdminEmail(email) || isCuratorEmail(email);
}

/**
 * Returns the caller's effective role for shared admin/curator surfaces.
 * "admin" overrides "curator" if the user is in both lists. "none" if
 * not signed in or in neither.
 */
export type ViewerRole = "admin" | "curator" | "none";
export async function getViewerRole(): Promise<ViewerRole> {
  const user = await currentUser();
  if (!user) return "none";
  const email = user.emailAddresses?.[0]?.emailAddress;
  if (isAdminEmail(email)) return "admin";
  if (isCuratorEmail(email)) return "curator";
  return "none";
}

/**
 * For use in /api/admin/* route handlers. Throws if caller is not admin.
 * Returns the Clerk user on success so handlers can use it.
 */
export async function assertAdmin() {
  const user = await currentUser();
  if (!user) {
    const err = new Error("Unauthorized") as Error & { status: number };
    err.status = 401;
    throw err;
  }
  const email = user.emailAddresses?.[0]?.emailAddress;
  if (!isAdminEmail(email)) {
    const err = new Error("Access denied") as Error & { status: number };
    err.status = 403;
    throw err;
  }
  return user;
}
