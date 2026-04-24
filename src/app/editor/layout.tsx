import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { phone: true },
  });

  // If the webhook hasn't created the row yet OR the phone is missing, the
  // user hasn't finished onboarding — bounce them through it first.
  if (!row?.phone) redirect("/onboarding");

  return <>{children}</>;
}
