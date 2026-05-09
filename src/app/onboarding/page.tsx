import { redirect } from "next/navigation";

/**
 * /onboarding — historically rendered the welcome wizard for first-time
 * users (confetti + impulse counter + 4-step instructions + phone form).
 * Removed May 2026: registration now collects email+phone in one step,
 * so the welcome screen's main purpose (contact capture) was redundant.
 *
 * The route is kept as a permanent redirect to /editor so:
 *   - Any old bookmarked link doesn't 404
 *   - Any old payment-flow that used `?redirect=/onboarding` still works
 *   - Search engines that indexed the URL get a clean redirect
 */
export default function OnboardingPage() {
  redirect("/editor");
}
