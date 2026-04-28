/**
 * Feature flags read from env. Single source of truth — anywhere we gate
 * UI or server logic on a flag, import from here so the default behavior
 * (unset env var) is consistent.
 */

/**
 * Are we accepting new registrations?
 *
 * Default: **closed** while we migrate to Veo 3 / Kling / Nano Banana.
 * Setting NEXT_PUBLIC_REGISTRATION_OPEN="true" in Vercel env (or
 * `.env.local`) reopens the site: /register renders Clerk's <SignUp />,
 * landing-page sign-up CTAs come back, the Clerk webhook resumes
 * granting starter impulses.
 *
 * To reopen for production: Vercel → Project → Settings → Environment
 * Variables → add NEXT_PUBLIC_REGISTRATION_OPEN=true (Production scope)
 * → Redeploy. To re-close: remove the var (or set it to anything other
 * than "true") and Redeploy.
 *
 * NEXT_PUBLIC_ prefix is required because the landing page reads this in
 * a client component.
 */
export function isRegistrationOpen(): boolean {
  return process.env.NEXT_PUBLIC_REGISTRATION_OPEN === "true";
}
