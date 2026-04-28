/**
 * Feature flags read from env. Single source of truth — anywhere we gate
 * UI or server logic on a flag, import from here so the default behavior
 * (unset env var) is consistent.
 */

/**
 * Are we accepting new registrations?
 *
 * Default: open. Setting NEXT_PUBLIC_REGISTRATION_OPEN="false" in Vercel
 * env (or `.env.local`) flips the whole site into maintenance mode for
 * sign-ups: /register shows a "platform updating" view, all sign-up CTAs
 * on the landing become a single "Войти" link, the Clerk webhook stops
 * granting starter impulses to anyone who manages to slip through.
 *
 * NEXT_PUBLIC_ prefix is required because the landing page reads this in
 * a client component.
 */
export function isRegistrationOpen(): boolean {
  return process.env.NEXT_PUBLIC_REGISTRATION_OPEN !== "false";
}
