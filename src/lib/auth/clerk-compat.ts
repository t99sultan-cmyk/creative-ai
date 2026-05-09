/**
 * Drop-in compatibility shim for Clerk's `auth()` and `currentUser()`
 * helpers. After the May 2026 migration to in-house auth, ~40 server
 * files imported these from `@clerk/nextjs/server`. Rather than touch
 * every call site, we re-export functions of the same name with the
 * same shape from this shim — call sites only swap the import path.
 *
 * Original signatures (Clerk):
 *   auth() → Promise<{ userId: string | null, sessionId, orgId, ... }>
 *   currentUser() → Promise<User | null> where User has emailAddresses[],
 *                   firstName, lastName, imageUrl, etc.
 *
 * Our shim:
 *   - auth(): returns { userId } only (the field everyone actually uses)
 *   - currentUser(): returns a Clerk-shaped User object built from our
 *     users table — emailAddresses[0].emailAddress is the real email,
 *     firstName/lastName/imageUrl are populated from our row.
 */

import { getServerUser } from "./getServerUser";

export interface AuthResult {
  userId: string | null;
}

/**
 * Mimics Clerk's `auth()`. Returns `{ userId }` from our session
 * cookie — callers typically destructure it as `const { userId } = await auth()`.
 */
export async function auth(): Promise<AuthResult> {
  const user = await getServerUser();
  return { userId: user?.userId ?? null };
}

interface ClerkLikeUser {
  id: string;
  emailAddresses: Array<{ emailAddress: string }>;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string;
  username: string | null;
}

/**
 * Mimics Clerk's `currentUser()`. Returns an object that looks like
 * Clerk's User on the fields the codebase actually reads:
 *   - emailAddresses[0].emailAddress
 *   - firstName, lastName  (we don't capture these in our DB; null)
 *   - imageUrl  (currently empty until we add avatar upload)
 *
 * Returns null if not logged in — same as Clerk.
 */
export async function currentUser(): Promise<ClerkLikeUser | null> {
  const user = await getServerUser();
  if (!user) return null;

  // Best-effort first/last from the stored display name. If `name`
  // contains a space we split it; otherwise use it as firstName only.
  // Most call sites only check existence, not specific parts.
  const fullName = user.name ?? "";
  const [firstName, ...rest] = fullName.split(" ");
  const lastName = rest.join(" ");

  return {
    id: user.userId,
    emailAddresses: [{ emailAddress: user.email }],
    firstName: firstName || null,
    lastName: lastName || null,
    imageUrl: user.image ?? "",
    username: null,
  };
}
