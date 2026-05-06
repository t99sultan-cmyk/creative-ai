"use server";

import { isAdmin, getViewerRole, type ViewerRole } from "@/lib/admin-guard";

/**
 * Client-callable boolean check: is the currently authenticated Clerk
 * user in the ADMIN_EMAILS allowlist? Used by the editor to swap
 * neutral "Вариант 1 / Вариант 2" labels for technical model names
 * ("Gemini 3 Pro Image" / "GPT Image 2") when an admin is testing.
 *
 * Fail-closed: if the user is not signed in or not in the allowlist,
 * returns false. No throw — callers can render the user-facing UI
 * without branching on errors.
 *
 * Note: during admin impersonation (Clerk session swap via /admin
 * "Войти как"), the Clerk session belongs to the impersonated user
 * and this returns false. That's intentional — the admin is testing
 * the user view, so they should see exactly what users see.
 */
export async function getIsAdmin(): Promise<boolean> {
  return isAdmin();
}

/**
 * Returns the caller's effective role on shared admin/curator surfaces.
 * Used by the dashboard client to conditionally render finance/admin-only
 * sections. Curators see the same page layout as admins, with cost and
 * revenue widgets hidden and personal-data columns redacted.
 */
export async function getMyRole(): Promise<ViewerRole> {
  return getViewerRole();
}
