/**
 * /products segment — public marketing surface for the marketplace
 * product-card generator (4th product alongside creatives, sites and
 * presentations). The wizard at /products/new gates on auth via its
 * own layout.
 */
export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
