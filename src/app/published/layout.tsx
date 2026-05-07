import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/**
 * /published — list of the caller's own published pages with
 * delete (soft-unpublish) action. Auth-gated.
 */
export default async function PublishedLayout({
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
