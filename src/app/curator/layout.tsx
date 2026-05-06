import { redirect } from "next/navigation";
import { isAdminOrCurator } from "@/lib/admin-guard";

/**
 * Curator-segment guard. Allows BOTH curators (CURATOR_EMAILS) and
 * admins (ADMIN_EMAILS) — admins use it as a preview of what curators
 * see. Anyone else lands on home.
 *
 * The page itself uses pathname.startsWith("/curator") to decide which
 * UI variant to render, NOT the actual user role — so an admin opening
 * /curator gets the redacted curator view.
 */
export default async function CuratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ok = await isAdminOrCurator();
  if (!ok) {
    redirect("/");
  }
  return <>{children}</>;
}
