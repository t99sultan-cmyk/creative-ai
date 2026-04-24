import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { WelcomeOnboarding } from "./WelcomeOnboarding";

/**
 * Post-signup welcome + phone capture.
 *
 * Server-component gate: if the user has already completed the welcome
 * flow (flag set by savePhone on submit), we bounce them straight to the
 * editor. This keeps /onboarding idempotent — bookmarking it or hitting
 * back later does not re-show the greeting.
 *
 * If the Clerk webhook hasn't yet landed and the DB row is missing,
 * we fall through to the welcome view; savePhone will create the row
 * on submit with welcomeShown=true.
 */
export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/register");

  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { welcomeShown: true },
  });

  if (row?.welcomeShown) redirect("/editor");

  return <WelcomeOnboarding />;
}
