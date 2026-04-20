import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Routes that require at least a logged-in Clerk session.
 * Admin-email allowlist is enforced in a deeper layer:
 *   - /admin pages → src/app/admin/layout.tsx (fail-closed redirect)
 *   - server actions in adminActions.ts → isAdmin() guard
 *   - /api/admin/* handlers → assertAdmin() helper from src/lib/admin-guard.ts
 */
const isProtectedRoute = createRouteMatcher([
  '/editor(.*)',
  '/admin(.*)',
  '/api/restricted(.*)',
  '/api/admin(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});
export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
