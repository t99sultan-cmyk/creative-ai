import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/**
 * /sites/new — site-generator wizard. Auth-gated; anonymous visitors
 * are bounced to /login (and Clerk redirects back here after sign-in).
 */
export default async function SitesNewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/login");
  }
  return <>{children}</>;
}
