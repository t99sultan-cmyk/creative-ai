/**
 * /presentations segment — public marketing surface.
 *
 * Mirrors /sites: /presentations itself is the feature landing page;
 * the wizard at /presentations/new gates on auth via its own layout.
 */
export default function PresentationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
