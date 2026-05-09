import { getServerUser } from "@/lib/auth/getServerUser";

/**
 * GET /api/me — returns the current logged-in user, or null.
 * Used by the AuthProvider on the client to populate global auth
 * state. Public endpoint — no gate, but only ever leaks data
 * about the caller themselves (the session cookie).
 */
export async function GET() {
  const user = await getServerUser();
  return Response.json({ user });
}

export const dynamic = "force-dynamic";
