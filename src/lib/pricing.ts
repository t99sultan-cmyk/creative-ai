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
 * Keep in sync with landing copy.
 */
export const SIGNUP_BONUS_IMPULSES = 7;

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
 * Direct image-gen path: 2 models in parallel
 *   • Gemini 3 Pro Image   (gemini-3-pro-image-preview, "Nano Banana Pro")
 *   • GPT Image 2          (gpt-image-2, OpenAI, quality medium)
 *
 * Nano Banana (the original gemini-2.5-flash-image) was dropped after
 * A/B testing — Pro variant gives noticeably better composition and
 * typography. The user picks 1/2/3 variants per model, so each click
 * produces 2/4/6 images. Cost is 2 impulses per image. Real API cost
 * at 1 variant (2 images):
 *   NB Pro ≈ $0.24, GPT-Image-2 medium ≈ $0.04. Total ≈ $0.28 ≈ 135 ₸.
 *   We charge 4 imp ≈ 210 ₸ → ~35% margin. Tuning is for later.
 */
export const STATIC_IMAGE_PER_VARIANT_COST = 2;
export const STATIC_IMAGE_MODEL_COUNT = 2;
export function staticImageTrioCost(variantCount: 1 | 2 | 3): number {
  return variantCount * STATIC_IMAGE_MODEL_COUNT * STATIC_IMAGE_PER_VARIANT_COST;
}

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

/**
 * Variable-length AI products: sites, presentations (HTML-slides),
 * marketplace product cards. Each follows the same pricing shape:
 *
 *   total = BASE + (extraElements × PER_ELEMENT)
 *
 * Where BASE covers the default element count (chosen on the wizard
 * slider's default position) and each element above the default adds
 * a linear surcharge.
 *
 * From-scratch generation = 1 variant (Claude Opus 4.7 only — picked as
 * the strongest for HTML/copy quality). v1 supported 2 (Claude + Gemini)
 * for blind A/B comparison; we collapsed to 1 to halve API cost and
 * simplify the UX.
 *
 * Refine of a single block/slide/card = REFINE_BLOCK_COST. Cheap so
 * users iterate to perfection without sticker shock.
 *
 * Default element counts (where BASE applies):
 *   sites          → 6 sections   (slider 3-12)
 *   presentations  → 10 slides    (slider 5-25)
 *   products       → 6 cards      (slider 3-12)
 *
 * Real API cost per default generation (1 variant, default count):
 *   1× Claude Opus HTML    ≈ $0.05
 *   N× Gemini 3 Pro Image  @ $0.04 each
 * Sites/products at 6 elements → 0.05 + 6×0.04 ≈ $0.29 ≈ 140 ₸
 * Presentations at 10        → 0.05 + 10×0.04 ≈ $0.45 ≈ 215 ₸
 *
 * BASE is set so default-count generation has a healthy margin even
 * for presentations (highest API cost).
 */
export const SITE_GEN_COST = 30;
export const PRESENTATION_GEN_COST = 30;
export const PRODUCTS_GEN_COST = 30;

/**
 * Linear surcharge per extra element above the default count.
 * Each extra slide / section / card adds ~$0.04 in API cost (image
 * gen). +3⚡ ≈ +150 ₸ retail → 70%+ margin on the marginal cost.
 */
export const PER_ELEMENT_COST = 3;

/**
 * Default element counts — the slider's pre-selected position when
 * the wizard opens. Pricing helper below uses these to compute the
 * extra-element surcharge.
 */
export const SITE_DEFAULT_SECTIONS = 6;
export const PRESENTATION_DEFAULT_SLIDES = 10;
export const PRODUCTS_DEFAULT_CARDS = 6;

/**
 * Refine cost — touch up one block/slide/card with a free-text
 * instruction ("поменяй заголовок на X", "сделай фон тёмнее"). Only
 * the targeted block regenerates; the rest stays. Mirrors the existing
 * VISION_REFINE_COST for the creatives editor.
 */
export const REFINE_BLOCK_COST = 5;

/**
 * Compute the total impulse cost for a generation, given:
 *   - product (sites/presentations/products)
 *   - element count chosen by the user
 * Returns BASE + extra-element surcharge.
 */
export function computeProductGenCost(
  product: "site" | "presentation" | "product-cards",
  count: number,
): number {
  const config = {
    site: { base: SITE_GEN_COST, def: SITE_DEFAULT_SECTIONS },
    presentation: { base: PRESENTATION_GEN_COST, def: PRESENTATION_DEFAULT_SLIDES },
    "product-cards": { base: PRODUCTS_GEN_COST, def: PRODUCTS_DEFAULT_CARDS },
  }[product];
  const extra = Math.max(0, count - config.def);
  return config.base + extra * PER_ELEMENT_COST;
}

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

// Sanity math — v2 single-model pipeline:
// 1 креатив (GPT Image 2) = 4⚡  (was 8 with dual Gemini+GPT)
// 1 сайт / презентация / карточки (Claude) = 30⚡ base + 3⚡/extra element
// 1 видео (Seedance) = 50⚡, 1 refine = 2-5⚡
// Per-impulse price (unchanged):
//   Старт:   2 490 / 45   = 55.3 ₸ / импульс
//   Креатор: 7 980 / 150  = 53.2 ₸ / импульс
//   Студия: 24 700 / 520  = 47.5 ₸ / импульс  (~14% scale discount)
//   Бизнес: 49 980 / 1200 = 41.7 ₸ / импульс  (~25% scale discount)
// Real API cost (single-model GPT Image 2) is ~$0.04 ≈ 20 ₸ per
// креатив. Margin ~85%. Sites/presentations/products at default count
// ≈ $0.30 ≈ 150 ₸ → 80% margin at retail 30⚡ × 52 = 1560 ₸.
export const PRICING_TIERS: PricingTier[] = [
  {
    name: "Старт",
    desc: "Попробовать на одной нише",
    priceKzt: 2490,
    priceLabel: "~2 490 ₸ / месяц",
    impulses: 45,
    features: [
      "~10 креативов в месяц (4⚡ каждый)",
      "ИЛИ 1 сайт (30⚡) + 5 креативов",
      "Кнопка «Улучшить» (vision-loop, 2⚡)",
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
      "~37 креативов в месяц",
      "ИЛИ 5 сайтов / презентаций (по 30⚡)",
      "Всё из Старта",
      "Все форматы (9:16, 1:1, 16:9)",
      "Видео-анимация 5/10 сек (50⚡)",
    ],
    btn: "Выбрать Креатор",
    action: "buy",
  },
  {
    name: "Студия",
    desc: "Для команд и масштабных кампаний",
    isHit: true,
    priceKzt: 24700,
    priceLabel: "~24 700 ₸ / месяц",
    impulses: 520,
    features: [
      "~130 креативов или 17 сайтов в месяц",
      "Всё из Креатора",
      "Приоритет в очереди (в 3× быстрее)",
      "Карточки товара для Kaspi/WB",
      "Согласованность стиля между креативами",
    ],
    btn: "Купить Студию",
    action: "buy",
  },
  {
    name: "Бизнес",
    desc: "Для агентств и больших команд",
    priceKzt: 49980,
    priceLabel: "~49 980 ₸ / месяц",
    impulses: 1200,
    features: [
      "~300 креативов или 40 сайтов в месяц",
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
