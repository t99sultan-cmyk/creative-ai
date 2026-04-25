/**
 * Niche-specific style hints injected into the Claude system prompt.
 *
 * Why a separate file: when the user has no reference image, the model
 * defaults to a generic "AI ad" look (slop). A short, niche-specific
 * style guide gives it a sensible default that matches local KZ market
 * expectations.
 *
 * Kept deliberately small (5 niches) — adding more without telemetry
 * would just be guessing. Once we have feedback data per niche we can
 * grow the catalogue.
 */

export type NicheId =
  | "general"
  | "dental"
  | "fitness"
  | "ecommerce"
  | "beauty"
  | "food";

export type NichePack = {
  id: NicheId;
  label: string; // shown in the UI
  systemHint: string; // injected into Claude system prompt
};

const PACKS: Record<NicheId, NichePack> = {
  general: {
    id: "general",
    label: "Без ниши",
    systemHint: "",
  },
  dental: {
    id: "dental",
    label: "Стоматология / клиника",
    systemHint: `
NICHE: Dental clinic / medical service. Default style guide when the
user provides no visual reference:
  - Palette: clinical clean — deep navy or teal as primary (#0E5BA8 /
    #0F766E range), pure white background, one warm accent (mint
    #BCE5DD or beige #F0E5D6). Avoid neon, bright reds, garish colors.
  - Typography: trust-building — Editorial New / Garamond serif for
    headlines paired with IBM Plex Sans or Söhne for body. NEVER use
    Comic Sans / playful display fonts — destroys credibility.
  - Mood: clean, premium, professional, approachable. NOT scary
    medical, NOT clinical-cold.
  - Layout cues: lots of white space, before/after split if photo
    available, doctor portrait composition, certification badges
    discrete in corner.
  - Trust signals to consider including: "Лицензия №", "10+ лет опыта",
    "Без боли", small icon row of guarantees.
  - Copy tone: outcome-first ("Зубы как новые за 1 визит"), CTA usually
    "Записаться на консультацию" or "Бесплатный осмотр".
  - AVOID: cartoon teeth, grinning mouth illustrations, neon "СКИДКА",
    overly aggressive sales tone.`,
  },
  fitness: {
    id: "fitness",
    label: "Фитнес / спорт",
    systemHint: `
NICHE: Fitness studio / gym / sport service. Default style guide when
the user provides no visual reference:
  - Palette: high-energy — deep black or charcoal background with ONE
    sharp neon accent (electric lime #C5FF3D, hot orange #FF5722, or
    cyber blue #00E5FF). Hard contrast. NOT pastel. NOT purple gradient.
  - Typography: athletic — bold condensed display (Druk, Anton,
    Bebas Neue) paired with industrial mono (JetBrains Mono, Space Mono)
    for stats and timestamps.
  - Mood: kinetic, sweaty, urgent, transformative. Show motion implied
    by typography (italic, slanted, layered).
  - Layout cues: large stacked typography, possibly skewed/rotated,
    corner data badges (CTR, results: "−8 кг за 3 мес"), grid of stats.
  - Copy tone: imperative ("Перестань ждать понедельника"), CTA
    "Бесплатная тренировка" or "Записаться на пробное".
  - AVOID: soft pastels, calm yoga aesthetics (unless brief asks for
    it), generic "transformation before/after" stock pose.`,
  },
  ecommerce: {
    id: "ecommerce",
    label: "Магазин / Kaspi-shop",
    systemHint: `
NICHE: E-commerce / Kaspi marketplace listing. Default style guide
when the user provides no visual reference:
  - Palette: product-first — clean neutral background (off-white,
    soft grey #F4F4F4, or a single bold brand color block). Price
    callout in a strong contrasting accent. Kaspi's red (#F14635)
    works as a known regional signal but isn't required.
  - Typography: utilitarian — Söhne / Inter Display for product name,
    bold weight for price. Big price, clear discount visualization
    (struck-through original price + new price + savings amount).
  - Mood: trust + savings + urgency. Product is the hero — copy
    supports it, doesn't compete with it.
  - Layout cues: product image dominates 60-70% of frame. Price tag
    or badge in a corner. Optional rating/reviews row. Tight crop on
    product, no "stock photo" ambient lifestyle clutter.
  - Trust elements to consider: "Доставка по РК", "Kaspi Red 0-0-12",
    "Гарантия 1 год", star rating.
  - Copy tone: transactional ("Скидка −30% до конца недели"), CTA
    "Купить в Kaspi" or "В корзину".
  - AVOID: artsy editorial spreads, abstract gradients with no product,
    generic shopping bag illustrations.`,
  },
  beauty: {
    id: "beauty",
    label: "Бьюти / косметика / салон",
    systemHint: `
NICHE: Beauty salon / cosmetics / aesthetic service. Default style
guide when the user provides no visual reference:
  - Palette: editorial soft — warm nudes (#F4E4D0 / #D4A574), dusty
    rose (#E0BFB4), creamy off-white, with one rich accent (deep
    burgundy #6B0F1A or matte gold #B8860B). NOT bubblegum pink. NOT
    neon. Aim for "Glossier" or "Aesop" feel.
  - Typography: refined — high-contrast serif (Editorial New, Migra,
    Tobias) for headline + clean grotesque (Söhne, GT America) for
    body. Letter-spacing matters: tracking on headline, normal on body.
  - Mood: sensorial, premium, calm but desirable. Negative space is
    a feature.
  - Layout cues: editorial magazine spread, asymmetric balance,
    macro product shot OR clean portrait. Big margins, restrained
    composition, NOT "stuffed".
  - Copy tone: evocative, sensory ("Кожа как после отпуска"), CTA
    minimal "Записаться" or just a phone number.
  - AVOID: hot pink + glitter overload, comic-book burst badges,
    sparkle emoji (✨ banned by global rule), aggressive sale stickers.`,
  },
  food: {
    id: "food",
    label: "Еда / кафе / ресторан",
    systemHint: `
NICHE: Food / cafe / restaurant. Default style guide when the user
provides no visual reference:
  - Palette: appetite-driving warmth — deep terracotta, mustard,
    forest green, cream, with the food itself providing the brightest
    color. Avoid blue/purple (suppresses appetite).
  - Typography: hand-feel — display serif (Bricolage Grotesque, DM
    Serif Display, Fraunces) or condensed slab (Recoleta, Domine).
    Body in friendly grotesque (Manrope, Söhne).
  - Mood: warm, inviting, mouth-watering. The hero is the food
    photo — design supports it.
  - Layout cues: full-bleed food image OR product photo with handcraft
    accents (chalkboard, paper texture, hand-drawn arrow). Price tag
    rustic, not sterile.
  - Copy tone: sensory ("Пицца на дровах за 12 минут"), CTA
    "Заказать в Glovo" or "Забронировать стол".
  - AVOID: stock photography vibe, grayscale, minimal cold modernism
    (food deserves warmth).`,
  },
};

export const NICHE_LIST: NichePack[] = Object.values(PACKS);

export function getNichePack(id: string | undefined | null): NichePack {
  if (!id) return PACKS.general;
  return PACKS[id as NicheId] ?? PACKS.general;
}
