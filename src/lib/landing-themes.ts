/**
 * Per-product color themes for the 4 marketing landings.
 *
 * Tailwind JIT requires literal class names — we cannot interpolate
 * `from-${theme.color}-500`, the JIT scanner won't see it. So every
 * theme exposes the FULL literal Tailwind classes, and components
 * pick the prop they need by name.
 *
 * Adding a new theme: add a key, fill in every literal class. Don't
 * leave fields blank — components rely on every key being present.
 */

export type LandingProduct = "creatives" | "sites" | "products" | "presentations";

export interface LandingTheme {
  product: LandingProduct;
  /** Display label in nav / breadcrumbs */
  label: string;
  /** URL where the wizard / editor lives */
  ctaHref: string;
  /** Used in the navbar logo dot, hero accent text, etc. */
  accentText: string; // e.g. "text-hermes-600"
  accentTextHover: string; // e.g. "hover:text-hermes-700"
  accentBg: string; // e.g. "bg-hermes-500"
  accentBgHover: string; // e.g. "hover:bg-hermes-600"
  accentBgSoft: string; // e.g. "bg-hermes-500/10"
  accentBorder: string; // e.g. "border-hermes-500/30"
  accentRing: string; // e.g. "ring-hermes-500/30"
  /** Gradient pair for hero CTA / final CTA / decorative ribbons */
  gradientFrom: string; // e.g. "from-hermes-500"
  gradientVia: string;
  gradientTo: string;
  /** Soft tinted bg for hero mockup card / pricing accent card */
  softBgFrom: string; // e.g. "from-hermes-50"
  softBgVia: string;
  softBgTo: string;
  /** Glow shadow on hero CTA / featured cards */
  glowShadow: string; // e.g. "shadow-hermes-500/30"
  /** Selection highlight color (used in main layout selection:bg-…) */
  selectionBg: string;
}

export const THEMES: Record<LandingProduct, LandingTheme> = {
  creatives: {
    product: "creatives",
    label: "Креативы",
    ctaHref: "/editor",
    accentText: "text-hermes-600",
    accentTextHover: "hover:text-hermes-700",
    accentBg: "bg-hermes-500",
    accentBgHover: "hover:bg-hermes-600",
    accentBgSoft: "bg-hermes-500/10",
    accentBorder: "border-hermes-500/30",
    accentRing: "ring-hermes-500/30",
    gradientFrom: "from-hermes-500",
    gradientVia: "via-orange-500",
    gradientTo: "to-amber-500",
    softBgFrom: "from-hermes-50",
    softBgVia: "via-amber-50",
    softBgTo: "to-orange-50",
    glowShadow: "shadow-hermes-500/30",
    selectionBg: "selection:bg-hermes-500/30",
  },
  sites: {
    product: "sites",
    label: "Сайты",
    ctaHref: "/sites/new",
    accentText: "text-sky-600",
    accentTextHover: "hover:text-sky-700",
    accentBg: "bg-sky-500",
    accentBgHover: "hover:bg-sky-600",
    accentBgSoft: "bg-sky-500/10",
    accentBorder: "border-sky-500/30",
    accentRing: "ring-sky-500/30",
    gradientFrom: "from-sky-500",
    gradientVia: "via-blue-500",
    gradientTo: "to-indigo-500",
    softBgFrom: "from-sky-50",
    softBgVia: "via-blue-50",
    softBgTo: "to-indigo-50",
    glowShadow: "shadow-sky-500/30",
    selectionBg: "selection:bg-sky-500/30",
  },
  products: {
    product: "products",
    label: "Карточки товара",
    ctaHref: "/products/new",
    accentText: "text-emerald-600",
    accentTextHover: "hover:text-emerald-700",
    accentBg: "bg-emerald-500",
    accentBgHover: "hover:bg-emerald-600",
    accentBgSoft: "bg-emerald-500/10",
    accentBorder: "border-emerald-500/30",
    accentRing: "ring-emerald-500/30",
    gradientFrom: "from-emerald-500",
    gradientVia: "via-teal-500",
    gradientTo: "to-cyan-500",
    softBgFrom: "from-emerald-50",
    softBgVia: "via-teal-50",
    softBgTo: "to-cyan-50",
    glowShadow: "shadow-emerald-500/30",
    selectionBg: "selection:bg-emerald-500/30",
  },
  presentations: {
    product: "presentations",
    label: "Презентации",
    ctaHref: "/presentations/new",
    accentText: "text-violet-600",
    accentTextHover: "hover:text-violet-700",
    accentBg: "bg-violet-500",
    accentBgHover: "hover:bg-violet-600",
    accentBgSoft: "bg-violet-500/10",
    accentBorder: "border-violet-500/30",
    accentRing: "ring-violet-500/30",
    gradientFrom: "from-violet-500",
    gradientVia: "via-purple-500",
    gradientTo: "to-fuchsia-500",
    softBgFrom: "from-violet-50",
    softBgVia: "via-purple-50",
    softBgTo: "to-fuchsia-50",
    glowShadow: "shadow-violet-500/30",
    selectionBg: "selection:bg-violet-500/30",
  },
};

/**
 * Static metadata for the 4-product navigation block. Used by
 * <ProductStack> on every landing — picks the entry matching
 * `currentProduct` and renders it as the highlighted card.
 */
export const PRODUCT_STACK_ITEMS: Array<{
  product: LandingProduct;
  href: string;
  title: string;
  desc: string;
  badge: "Live" | "Beta" | "Скоро";
  cost: string;
}> = [
  {
    product: "creatives",
    href: "/editor",
    title: "Креативы",
    desc: "Постеры и motion-креативы для Instagram, TikTok, Kaspi-таргета.",
    badge: "Live",
    cost: "4 ⚡",
  },
  {
    product: "products",
    href: "/products",
    title: "Карточки товара",
    desc: "Готовые карточки для Kaspi и Wildberries — герой, infographics, lifestyle.",
    badge: "Beta",
    cost: "30 ⚡",
  },
  {
    product: "sites",
    href: "/sites",
    title: "Сайты",
    desc: "Single-page landing с hero, фичами, CTA. Публикация на нашем домене.",
    badge: "Beta",
    cost: "30 ⚡",
  },
  {
    product: "presentations",
    href: "/presentations",
    title: "Презентации",
    desc: "HTML-слайды из 7 слайдов. Открывается по ссылке, листается стрелками.",
    badge: "Beta",
    cost: "30 ⚡",
  },
];
