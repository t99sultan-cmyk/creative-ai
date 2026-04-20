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
