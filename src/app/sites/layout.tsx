/**
 * /sites segment — public marketing surface.
 *
 * /sites itself is the feature landing page (marketing copy, benefits,
 * CTA → /sites/new). Anyone — signed-in or anonymous — can view it.
 *
 * Auth-gating happens one level deeper at /sites/new/layout.tsx, which
 * is the actual wizard. The published-page route /s/{slug} is its own
 * top-level public segment (no auth required for shared links).
 */
export default function SitesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
