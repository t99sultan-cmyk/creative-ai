import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-guard";

/**
 * Admin-only segment guard.
 *
 * Runs on the server before any /admin/* page renders. If the visitor is
 * logged in but NOT in ADMIN_EMAILS → redirect to home.
 * If not logged in at all → proxy.ts sends them to Clerk sign-in first.
 *
 * This is fail-closed: an empty ADMIN_EMAILS env var → nobody gets in.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ok = await isAdmin();
  if (!ok) {
    redirect("/");
  }
  return <>{children}</>;
}
