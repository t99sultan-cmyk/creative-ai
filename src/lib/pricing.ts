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

// Sanity math — why these numbers:
// 1 статика = 3 импульса · 1 анимация = 4 импульса (/api/generate:cost).
// Implied per-impulse price at tier:
//   Старт:   2 490 / 45   = 55.3 ₸ / импульс
//   Креатор: 7 980 / 150  = 53.2 ₸ / импульс
//   Студия: 24 700 / 520  = 47.5 ₸ / импульс  (~14% scale discount)
//   Бизнес: 49 980 / 1200 = 41.7 ₸ / импульс  (~25% scale discount)
// Unit cost per creative reveals a clear "volume pays less" story.
// Real API cost (Claude Opus + Cloud Run) is ~20-35 ₸ per static, ~25-45 ₸
// per animated (render is the expensive part). Tier margins above cover
// infra, support, and leave ~30-50% gross profit.
export const PRICING_TIERS: PricingTier[] = [
  {
    name: "Старт",
    desc: "Попробовать на одной нише",
    priceKzt: 2490,
    priceLabel: "~2 490 ₸ / месяц",
    impulses: 45,
    features: [
      "~15 статичных креативов",
      "ИЛИ ~11 анимированных",
      "Качество 4K",
      "Без водяных знаков",
      "Обновление каждый месяц",
    ],
    btn: "Начать со Старта",
    action: "buy",
  },
  {
    name: "Креатор",
    desc: "Для малого бизнеса",
    priceKzt: 7980,
    priceLabel: "~7 980 ₸ / месяц",
    impulses: 150,
    features: [
      "~50 статичных или ~38 анимированных",
      "Всё из Старта",
      "Удаление фона",
      "Все форматы (9:16, 1:1, 16:9)",
      "Библиотека шаблонов",
    ],
    btn: "Выбрать Креатор",
    action: "buy",
  },
  {
    name: "Студия",
    desc: "Для A/B тестов и масштабных кампаний",
    isHit: true,
    priceKzt: 24700,
    priceLabel: "~24 700 ₸ / месяц",
    impulses: 520,
    features: [
      "~173 статичных или ~130 анимированных",
      "Всё из Креатора",
      "A/B тесты: до 4 вариантов на 1 бриф",
      "Приоритет в очереди (в 3× быстрее)",
      "Согласованность стиля между креативами",
    ],
    btn: "Купить Студию",
    action: "buy",
  },
  {
    name: "Бизнес",
    desc: "Для агентств и команд",
    priceKzt: 49980,
    priceLabel: "~49 980 ₸ / месяц",
    impulses: 1200,
    features: [
      "~400 статичных или ~300 анимированных",
      "Всё из Студии",
      "Управление командой (до 5 пользователей)",
      "Бренд-кит: единый стиль для всей команды",
      "Приоритетная поддержка",
    ],
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
