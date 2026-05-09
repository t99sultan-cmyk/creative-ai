/**
 * Drop-in replacement for Clerk's `auth()` and `currentUser()` helpers.
 *
 * Old (Clerk) call sites pulled `userId` from `auth()` and full user
 * data (email, name, image) from `currentUser()`. The new in-house
 * auth makes both available from one async helper that hits the
 * session cookie + a single users-table read.
 *
 * Returned shape mirrors the fields actually used across the codebase
 * (verified against the 40+ call sites surveyed during the migration).
 * If a future call needs a field not on this shape — add it here, not
 * on the call site.
 */

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { readSession } from "./session";

export interface ServerUser {
  /** Internal user id (was Clerk userId previously). */
  userId: string;
  /** Primary email — lower-cased on registration. */
  email: string;
  /** Optional display name; falls back to email-local-part when missing. */
  name: string | null;
  /** Avatar URL (post-Clerk we don't auto-fill, so usually null until
   *  the user uploads one). */
  image: string | null;
}

/**
 * Returns the current user, hitting both the session cookie (HMAC-
 * verified JWT) AND the users table for the canonical record. Null
 * if the cookie is missing/expired/forged or the DB row was deleted.
 *
 * Use in server components, server actions, API routes. NEVER from
 * client components — they have no cookies access.
 */
export async function getServerUser(): Promise<ServerUser | null> {
  const session = await readSession();
  if (!session) return null;

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
    })
    .from(users)
    .where(eq(users.id, session.uid))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    userId: row.id,
    email: row.email,
    name: row.name,
    image: row.image,
  };
}

/**
 * Lightweight version that ONLY checks the session cookie, no DB hit.
 * Use in middleware (Edge runtime) where we want to gate routes
 * cheaply without a DB roundtrip on every request.
 */
export async function getSessionUserId(): Promise<string | null> {
  const session = await readSession();
  return session?.uid ?? null;
}
