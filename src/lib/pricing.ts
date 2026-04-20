/**
 * Single source of truth for pricing tiers.
 * Mirrors the tiers shown on the landing page (src/app/page.tsx).
 *
 * Used by:
 *   - Landing page pricing section
 *   - Admin financial dashboard (revenue estimates)
 *   - Any future Kaspi/card checkout
 */

export type PricingTier = {
  name: string;
  desc: string;
  isHit?: boolean;
  priceKzt: number; // numeric price in KZT (used for math)
  priceLabel: string; // human label shown in UI
  impulses: number;
  features: string[];
  btn: string;
  action: "buy" | "free";
};

export const PRICING_TIERS: PricingTier[] = [
  {
    name: "Старт",
    desc: "На 1–3 ниши",
    priceKzt: 1990,
    priceLabel: "~1 990 ₸",
    impulses: 60,
    features: ["~15 статичных креативов", "ИЛИ ~11 анимированных", "Высокое качество 4K", "Без водяных знаков"],
    btn: "Начать со Старта",
    action: "buy",
  },
  {
    name: "Креатор",
    desc: "Для малого бизнеса",
    priceKzt: 4980,
    priceLabel: "~4 980 ₸",
    impulses: 150,
    features: ["~42 статичных креатива", "ИЛИ ~31 анимированных", "Удаление фона", "Все форматы (9:16, 1:1)"],
    btn: "Выбрать Креатор",
    action: "buy",
  },
  {
    name: "Студия",
    desc: "ХИТ. A/B тесты",
    isHit: true,
    priceKzt: 14980,
    priceLabel: "~14 980 ₸",
    impulses: 453,
    features: ["~151 статичных креативов", "ИЛИ ~113 анимированных", "Студийный свет и тени", "Приоритет в очереди"],
    btn: "Купить Студию",
    action: "buy",
  },
  {
    name: "Бизнес",
    desc: "Для мощных агентств",
    priceKzt: 49980,
    priceLabel: "~49 980 ₸",
    impulses: 1900,
    features: ["~633 статичных креативов", "ИЛИ ~474 анимированных", "Управление командой", "Единый бренд-стиль"],
    btn: "Купить Бизнес",
    action: "buy",
  },
];

/**
 * Estimate revenue from an impulse-denominated purchase.
 * If impulses exactly match a tier → use that tier's price.
 * Otherwise → prorate at the closest-tier price-per-impulse rate.
 *
 * NOTE: This is an estimate only. Real revenue should come from an `orders`
 * table once Kaspi/card checkout is integrated.
 */
export function estimateRevenueKztFromImpulses(impulses: number): number {
  if (impulses <= 0) return 0;

  // Exact tier match
  const exact = PRICING_TIERS.find((t) => t.impulses === impulses);
  if (exact) return exact.priceKzt;

  // Find the tier with the closest impulse count
  const closest = [...PRICING_TIERS].sort(
    (a, b) => Math.abs(a.impulses - impulses) - Math.abs(b.impulses - impulses),
  )[0];
  const rate = closest.priceKzt / closest.impulses;
  return Math.round(impulses * rate);
}

/**
 * Average price per impulse across tiers (weighted by volume).
 * Useful as a simple headline: "1 impulse ≈ X ₸".
 */
export function avgKztPerImpulse(): number {
  const totalKzt = PRICING_TIERS.reduce((s, t) => s + t.priceKzt, 0);
  const totalImp = PRICING_TIERS.reduce((s, t) => s + t.impulses, 0);
  return Math.round(totalKzt / totalImp);
}
