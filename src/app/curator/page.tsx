/**
 * Curator dashboard — re-exports the admin page component. The same
 * client component renders for both /admin and /curator; it reads
 * window.location.pathname on mount and switches to the curator variant
 * (cost/revenue widgets hidden, admin-only buttons hidden, personal
 * contact data redacted) when on /curator.
 *
 * Server-side authorization is enforced by /curator/layout.tsx
 * (isAdminOrCurator gate). Server actions further redact financial
 * fields for curator-role callers, so even if the client tried to call
 * them with admin-mode UI flags it would still see zeros.
 */
export { default } from "../admin/page";
