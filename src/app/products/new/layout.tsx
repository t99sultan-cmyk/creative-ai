import { auth } from "@/lib/auth/clerk-compat";
import { redirect } from "next/navigation";

/**
 * /products/new — product-card wizard (placeholder for now). Auth-gated.
 */
export default async function ProductsNewLayout({
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
