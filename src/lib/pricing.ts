/**
 * Single source of truth for pricing tiers.
 * Mirrors the tiers shown on the landing page (src/app/page.tsx).
 *
 * Used by:
 *   - Landing page pricing section
 *   - Admin financial dashboard (revenue estimates)
 *   - Any future Kaspi/card checkout
 */

/**
 * Impulses every new user gets on first sign-up.
 * 12 = enough for either:
 *   • 2 dual-model static generations (2 × 6 = 12), or
 *   • 1 dual-model static + 1 refine (6 + 2 = 8, with leftover), or
 *   • 1 dual-model animated + 1 refine (8 + 2 = 10, with leftover).
 * Keep in sync with landing copy ("12 импульсов в подарок").
 */
export const SIGNUP_BONUS_IMPULSES = 12;

/**
 * Per-generation impulse cost. Each click on "Сгенерировать" runs THREE
 * outputs in parallel so the user can compare:
 *   • Claude Opus 4.7   → HTML (motion or static)
 *   • Gemini 3.1 Pro    → HTML
 *   • Imagen 4 (Google) → PNG image (static rendered creative)
 *
 * Combined API cost ≈ $0.39 for static (~187 ₸), $0.65 for animated.
 *
 * Static: 8 impulses ≈ 420 ₸ → ~55% margin.
 * Animated: 10 impulses ≈ 525 ₸ → ~20% margin (animated HTML is more
 *   expensive at Anthropic; Imagen still adds nominal cost).
 *
 * Legacy values (6 / 8) stay valid for any pre-existing creatives in
 * the DB; the cost column on each row records what was actually charged
 * at the time, not the current default.
 */
export const STATIC_DUAL_COST = 8;
export const ANIMATED_DUAL_COST = 10;

/**
 * Imagen 4 image generation cost (Google). $0.04 per image ≈ 19 ₸.
 * Included in the bundled STATIC_DUAL_COST — no separate charge for the
 * 3rd "image" card. We raised STATIC_DUAL_COST from 6 to 8 to absorb it.
 */
export const IMAGE_GEN_API_USD = 0.04;

/**
 * Veo 3 video generation cost (Google) — separate, opt-in via the
 * "Сделать видео" button under the winner.
 * Veo 3 charges ~$0.50-0.75 per second of generated video. An 8-second
 * clip ≈ $4-6 ≈ 2400 ₸ at our KZT rate. We charge 50 impulses ≈ 2625 ₸
 * → ~9% margin. Tight but acceptable; can raise later.
 */
export const VIDEO_GEN_COST = 50;

/**
 * "Улучшить" (vision-loop refine) — sends the generated render back to the
 * model for self-critique. +1 API call ≈ $0.30. Charged separately so the
 * user only pays when they actually want a fix.
 */
export const VISION_REFINE_COST = 2;

/**
 * Canvas mode (full agentic loop with tool_use) — Claude Sonnet 4.6
 * iterates up to 5 times, using a `render_creative` tool to see its
 * own work and fix layout issues in-loop. This is what gemini.google.com
 * Canvas does internally. With Sonnet 4.6 (5× cheaper than Opus, but
 * #1 on WebDev Arena for HTML/UI aesthetics) the API cost is ~$0.40-0.80
 * per generation (5 iterations).
 *
 * Single output (no dual). Users get one polished creative.
 * Quality vs gemini.google.com Canvas is targeted at ~85-90% parity.
 */
export const CANVAS_GENERATE_COST = 10;

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
// 1 dual-static = 6 импульсов (Claude+Gemini параллельно).
// 1 dual-animated = 8 импульсов.
// 1 refine ("Улучшить") = 2 импульса доплатой.
// Implied per-impulse price at tier (unchanged):
//   Старт:   2 490 / 45   = 55.3 ₸ / импульс  → ~7 dual-static в месяц
//   Креатор: 7 980 / 150  = 53.2 ₸ / импульс  → ~25 dual-static в месяц
//   Студия: 24 700 / 520  = 47.5 ₸ / импульс  (~14% scale discount) → ~86 dual-static
//   Бизнес: 49 980 / 1200 = 41.7 ₸ / импульс  (~25% scale discount) → ~200 dual-static
// Real API cost (Claude Opus + Gemini 3.1 + Cloud Run) is ~280-360 ₸ per
// dual-static, ~340-420 ₸ per dual-animated. Tier margins still cover
// infra+support but margin сжимается с ~40% до ~20% — компенсируем
// объёмом и тем что dual-сравнение продаёт качество.
export const PRICING_TIERS: PricingTier[] = [
  {
    name: "Старт",
    desc: "Попробовать на одной нише",
    priceKzt: 2490,
    priceLabel: "~2 490 ₸ / месяц",
    impulses: 45,
    features: [
      "~7 dual-сравнений (Claude vs Gemini)",
      "ИЛИ ~5 анимированных dual",
      "Кнопка «Улучшить» (vision-loop)",
      "Качество 4K, без водяных знаков",
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
      "~25 dual-сравнений (Claude+Gemini)",
      "ИЛИ ~18 анимированных dual",
      "Всё из Старта",
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
      "~86 dual-сравнений или ~65 анимированных",
      "Всё из Креатора",
      "Приоритет в очереди (в 3× быстрее)",
      "Согласованность стиля между креативами",
      "Расширенная статистика по моделям",
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
      "~200 dual-сравнений или ~150 анимированных",
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
