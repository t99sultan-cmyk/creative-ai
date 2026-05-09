import { auth } from "@/lib/auth/clerk-compat";
import { redirect } from "next/navigation";

/**
 * /presentations/new — deck-generator wizard. Auth-gated.
 */
export default async function PresentationsNewLayout({
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
