import { clearSessionCookie } from "@/lib/auth/session";

/**
 * POST /api/auth/logout — clears the session cookie. Idempotent.
 * Called by the AuthProvider's signOut() helper.
 */
export async function POST() {
  await clearSessionCookie();
  return Response.json({ success: true });
}
