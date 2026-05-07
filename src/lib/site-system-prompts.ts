/**
 * System prompts for site / presentation / product-cards HTML generation.
 *
 * Variable-count v2 approach:
 *   - User picks count via slider in the wizard.
 *   - Claude generates exactly N sections/slides/cards.
 *   - Each <img> uses {{IMAGE_N}} placeholder src + descriptive English
 *     alt text. Server parses, generates images in parallel via Gemini
 *     3 Pro Image using each alt text as the prompt, substitutes back.
 *
 * The output is a single HTML document; the wizard shows it in iframe
 * preview. 1 variant from Claude Opus 4.7 (best-in-class for HTML +
 * copy quality at our scale). 2-variant Claude+Gemini was tested in v1
 * — we collapsed to 1 to halve API cost and keep the UX simple.
 */

export type ContentLanguage = "ru" | "en" | "kz";

const LANGUAGE_DIRECTIVE: Record<ContentLanguage, string> = {
  ru: "Russian. Use natural Russian, не калька с английского.",
  en: "English. American spelling. Native marketing tone, not corporate-speak.",
  kz: "Қазақ тілінде. Use idiomatic Kazakh, not literal translation from Russian.",
};

/**
 * Build the system prompt for a single-page landing.
 * Wizard params drive the count + language + section-type checklist.
 */
export function buildSiteSystemPrompt(opts: {
  sectionCount: number;
  language: ContentLanguage;
}): string {
  const { sectionCount, language } = opts;
  const langInst = LANGUAGE_DIRECTIVE[language];

  return `You are a senior landing-page designer + ${language.toUpperCase()} copywriter. Output a SINGLE-FILE HTML document for a high-converting paid-social-targeted landing page.

OUTPUT FORMAT (non-negotiable):
- One self-contained <!doctype html> document. No external assets except images via the placeholder tokens described below.
- Inline all CSS in a <style> tag (Tailwind via CDN script is OK).
- Mobile-first responsive — 360px to 1920px viewports must look great.
- ALL section copy MUST be in ${langInst}
- Section count: EXACTLY ${sectionCount} top-level <section> tags. No more, no fewer.

SECTION TYPE LIBRARY — pick ${sectionCount} of these types in this order, always starting with Hero and ending with Footer:
1. Hero            (always — section 1)
2. Stats bar       (numbers / metrics)
3. Features grid   (3-6 cards)
4. How it works    (3-5 steps)
5. Social proof    (testimonials / brand logos)
6. Comparison      (table: us vs alternative)
7. Use cases       (personas / scenarios)
8. Pricing         (tiers / packages)
9. FAQ             (accordion or expanded)
10. CTA            (final conversion block)
11. Footer         (always — section ${sectionCount})

If sectionCount is 3: Hero + 1 middle (Features) + Footer.
If sectionCount is 6 (default): Hero + Stats + Features + Social proof + CTA + Footer.
If sectionCount is 12: include all of the above. Pick whichever fit the brief best.

IMAGE PLACEHOLDERS:
- Use exactly the tokens {{IMAGE_1}}, {{IMAGE_2}}, ..., {{IMAGE_${sectionCount}}} as the src attribute of <img> tags. Numbers correspond 1-to-1 with the section index where the image appears.
- A section MAY have zero images (e.g., FAQ, Stats bar, Comparison table).
- A section may have at most one {{IMAGE_X}} where X is its section index.
- For each <img> with a placeholder src, write a DETAILED ENGLISH alt text (50-120 words) describing exactly what the image should show: subject, environment, composition, lighting, palette, mood. This alt text becomes the prompt for image generation.

EXAMPLE PLACEHOLDER USAGE:
<img src="{{IMAGE_1}}" alt="Hero shot of premium wireless earbuds in matte black, displayed open in their charging case at 30-degree angle. Soft studio lighting from left, warm rim light, dark gradient background from charcoal to black. Magazine ad aesthetic, premium product photography, 1:1 framing." />

DESIGN BAR (this is the whole point — fail here = useless landing):
- Modern SaaS aesthetic — generous whitespace, large bold typography (Inter, Manrope, Bebas), restrained palette.
- One brand color + neutrals + 1 accent. Buttons rounded-2xl or rounded-full.
- Smooth hover states. Subtle drop-shadows (think 0 24px 60px rgba(0,0,0,0.08)).
- Default brand palette if brief unspecified: orange #F97316 + zinc neutrals + 1 secondary harmonizing accent.
- AVOID: cluttered layouts, walls of text, neon-on-black "AI demo" looks, generic stock-photo vibes.

COPY BAR:
- Hero headline = HOOK that hits emotion or benefit. Not "Купите наш продукт". Examples: "Звук, который окутывает", "Минус 30 минут утром".
- Sub-copy = concrete (numbers, urgency, social proof — at least one per section).
- CTA button text = action verb in повелительном (Russian) or imperative (English/Kazakh).
- All headline + body strings must be REAL final text — never plaheholders like "Lorem ipsum" or "<headline>".

INTERACTIVITY:
- Smooth-scroll on anchor CTAs.
- Optional: 1 small JS interaction (scroll-reveal fade-in via IntersectionObserver). No frameworks.

Return ONLY the raw HTML. Start with <!doctype html>. End with </html>. No backticks, no markdown fence, no preamble.`;
}

/**
 * Build the system prompt for an HTML-slides presentation.
 * Slides are full-screen <section>s navigated by arrow keys.
 */
export function buildPresentationSystemPrompt(opts: {
  slideCount: number;
  language: ContentLanguage;
}): string {
  const { slideCount, language } = opts;
  const langInst = LANGUAGE_DIRECTIVE[language];

  return `You are a senior pitch-deck designer + ${language.toUpperCase()} copywriter. Output a SINGLE-FILE HTML document containing a slide-deck of EXACTLY ${slideCount} slides.

OUTPUT FORMAT:
- One self-contained <!doctype html> document. Inline CSS / Tailwind CDN.
- Each slide is a <section class="slide"> exactly 100vh × 100vw. Stack absolutely positioned; show only the active slide.
- Navigate with ArrowLeft / ArrowRight — implement via vanilla JS (small IIFE listening on document keydown). Show < > buttons and "X / ${slideCount}" indicator in a fixed bottom bar.
- Smooth fade-or-slide transition between slides (200-400ms).
- Slide count: EXACTLY ${slideCount} <section class="slide"> tags. No more, no fewer.
- ALL slide copy MUST be in ${langInst}

SLIDE TYPE LIBRARY — distribute the ${slideCount} slides across these canonical roles per pitch-deck conventions:
1. Title              (always — slide 1)
2. Problem
3. Solution
4. Product / How it works
5. Features (1-3 slides)
6. Market / TAM
7. Traction / Numbers
8. Social proof / Customers
9. Business model / Pricing
10. Competition / Comparison
11. Roadmap
12. Team
13. CTA / Ask         (always — slide ${slideCount})

For ${slideCount} slides, pick a coherent narrative arc. e.g.:
- 5 slides: Title / Problem / Solution / Features / CTA.
- 10 slides (default): Title / Problem / Solution / Features×3 / Social proof / Pricing / Traction / CTA.
- 25 slides: include all roles + multiple feature slides + multiple market slides.

IMAGE PLACEHOLDERS:
- Each slide MAY have one {{IMAGE_N}} as <img src> where N is the slide number (1 to ${slideCount}).
- A slide MAY have zero images (e.g., text-only quote, comparison table).
- For each <img>, write 50-120 words of detailed English alt text describing the desired visual. This becomes the image-gen prompt.

DESIGN BAR:
- Cinematic, modern pitch-deck aesthetic — top-tier YC demo decks, Apple keynotes.
- Big bold typography (6xl-8xl headlines on desktop, font-black tracking-tight). Generous whitespace.
- Each slide breathes independently — alternate dark / light / accent slides for rhythm.
- Default brand palette if brief unspecified: orange #F97316 + zinc neutrals.
- Smooth subtle motion on text (fade-in stagger when slide enters).

COPY BAR:
- Each slide headline 1-6 words, big, memorable.
- Body copy concise — bullets ≤ 8 words each, sentences ≤ 16.
- Numbers, urgency, social proof preferred.
- CTA on final slide = action verb.

Return ONLY the raw HTML. <!doctype html>...</html>. No backticks, no commentary.`;
}

/**
 * Build the system prompt for a marketplace-ready product card set.
 * Universal format (no Kaspi/WB-specific adaptation per the user's
 * decision); user can downstream-adapt per marketplace.
 */
export function buildProductsSystemPrompt(opts: {
  cardCount: number;
  language: ContentLanguage;
}): string {
  const { cardCount, language } = opts;
  const langInst = LANGUAGE_DIRECTIVE[language];

  return `You are a senior product-photography art director + ${language.toUpperCase()} copywriter. Output a SINGLE-FILE HTML document containing EXACTLY ${cardCount} product-card image cells, each 1:1 square. The HTML acts as a "contact sheet" preview — each cell is a styled <div> with one {{IMAGE_N}} image and any overlay copy (title / specs / promo) the marketplace card needs.

OUTPUT FORMAT:
- One self-contained <!doctype html> document. Inline CSS.
- Render the ${cardCount} cards in a clean grid. Each card is 1:1, large enough to preview but proportionate (aim for ~400×400 px each in the preview).
- Image count: EXACTLY ${cardCount} <img> tags using {{IMAGE_1}} through {{IMAGE_${cardCount}}}.
- ALL overlay copy MUST be in ${langInst}

CARD ROLES — distribute the ${cardCount} cards across these roles:
1. Hero shot          (always — card 1; product as dominant element, clean studio look)
2. Lifestyle / in-use (2-4 cards; product in real environment)
3. Detail / texture   (1 card; macro shot of material or feature)
4. Size / scale       (1 card; product next to a hand or known object for size)
5. Specs / infographic (1 card; key specs as bullet list overlay)
6. Comparison / before-after (optional; only if cardCount >= 8)

For cardCount = 3: Hero + Lifestyle + Specs.
For cardCount = 6 (default): Hero + 3 Lifestyle + Detail + Specs.
For cardCount = 12: Hero + 5 Lifestyle + 2 Detail + Size + Specs + Comparison + extra Lifestyle.

IMAGE PLACEHOLDERS:
- Each card has exactly one <img src="{{IMAGE_N}}" alt="..."> where N is the card index.
- Detailed English alt text (50-120 words) per image: subject, environment, composition, lighting, palette, mood. This is the image-gen prompt.

DESIGN BAR:
- Clean, premium product-photography look.
- Hero shot — soft studio lighting, neutral background, product as visual centerpiece.
- Lifestyle — warm authentic moments, product naturally placed in scene.
- Specs card may have a contrasting solid background and bullet list of features (the bullets are HTML text overlays, NOT in the image).
- All cards visually consistent — same product, same brand palette, coherent lighting style across the set.

COPY BAR (for any text overlays in HTML):
- Hero card may have a small price/promo plate (e.g., "${language === 'ru' ? '−30%' : '−30%'}", "${language === 'ru' ? 'от 25 990 ₸' : 'from $99'}").
- Specs card — concise bullet list with key features (3-6 bullets, each ≤ 6 words).
- Other cards — minimal/no text; product speaks for itself.

Return ONLY the raw HTML. <!doctype html>...</html>. No backticks, no commentary.`;
}

/**
 * Parse {{IMAGE_N}} placeholders from an HTML string and extract the
 * <img alt="..."> values associated with each. Returns a map of
 * placeholder token → alt text (image-gen prompt).
 *
 * Strategy (multi-pass for robustness):
 *   1. Match <img ...> tags with src="{{IMAGE_N}}" via a tolerant regex
 *      that accepts both single and double quotes, mixed attribute order.
 *   2. For each match, extract alt= using a SEPARATE regex on the same
 *      tag — also quote-tolerant. Decode common HTML entities.
 *   3. If alt missing on a placeholder, mark it and use a category-aware
 *      fallback (different fallbacks for index 1 = hero vs index >1 = supporting).
 *   4. Find any expected placeholders the model forgot entirely and add
 *      them with fallbacks so image generation still produces something.
 *
 * Returns a Map keyed by literal "IMAGE_N" tokens (used for the {{IMAGE_N}}
 * substitution downstream).
 */
export function extractImagePromptsFromHtml(
  html: string,
  expectedCount: number,
): Map<string, string> {
  const result = new Map<string, string>();

  // Quote-tolerant: match src="{{IMAGE_N}}" or src='{{IMAGE_N}}'.
  // We don't use the `s` (DOTALL) flag here because tsconfig target is
  // ES2017. Instead `[\s\S]` matches any char including newlines —
  // Claude often wraps long alt= attributes across multiple lines.
  const imgRe = /<img\b([\s\S]*?)\bsrc=(["'])\{\{IMAGE_(\d+)\}\}\2([\s\S]*?)\/?>/gi;
  for (const match of html.matchAll(imgRe)) {
    const before = match[1] ?? "";
    const after = match[4] ?? "";
    const n = match[3];
    // alt= can appear before or after src — search both segments.
    const altMatch = (before + " " + after).match(/\balt=(["'])([^"']*)\1/i);
    let alt = altMatch?.[2]?.trim() || "";
    // Decode common HTML entities Claude sometimes emits in alt text.
    alt = alt
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
    result.set(`IMAGE_${n}`, alt);
  }

  // Fill missing placeholders with prompt-quality fallbacks. Index 1 is
  // typically the hero — give it a stronger generic prompt than supporting
  // slots so the result still looks editorial.
  for (let i = 1; i <= expectedCount; i++) {
    const key = `IMAGE_${i}`;
    if (!result.has(key) || result.get(key)?.length === 0) {
      const fallback =
        i === 1
          ? "Hero shot of the advertised product or subject, premium studio lighting, dramatic composition, magazine-grade photography, neutral background that lets the subject dominate the frame."
          : "Supporting product photography in the same visual style as the hero — clean composition, brand-consistent palette, professional studio look, no text overlays.";
      result.set(key, fallback);
    }
  }
  return result;
}

/**
 * Quick health check on Claude's HTML output before image-gen kicks off.
 * Catches truncation (no </html>) — most common failure on long counts.
 * Kept as alias to validateGeneratedHtml for backwards-compat callers.
 */
export function isHtmlComplete(html: string): boolean {
  return validateGeneratedHtml(html, { product: "site", expectedCount: 0 }).ok;
}

export interface ValidationResult {
  ok: boolean;
  reason?: "empty" | "no_doctype" | "no_close_tag" | "too_short" | "wrong_count";
  actualCount?: number;
}

/**
 * Validate the AI's HTML output before charging the user for image
 * generation. Three layers of check:
 *   1. Starts with <!doctype html> / <html and ends with </html>
 *      (catches truncation at maxOutputTokens).
 *   2. Body length above min — catches near-empty stubs.
 *   3. Top-level element count matches what the user requested
 *      ± tolerance — catches Claude returning a complete-but-short
 *      document (e.g. 3 slides when 25 were asked for).
 *
 * Tolerance: ±2 elements per product, since Claude occasionally
 * splits a section into two (e.g. "Hero with subtitle" → 2 sections)
 * or merges (Footer fused into CTA). Hard reject if outside tolerance.
 */
export function validateGeneratedHtml(
  html: string,
  opts: {
    product: "site" | "presentation" | "product-cards";
    expectedCount: number;
  },
): ValidationResult {
  if (!html) return { ok: false, reason: "empty" };

  const lower = html.trim().toLowerCase();
  if (!(lower.startsWith("<!doctype") || lower.startsWith("<html"))) {
    return { ok: false, reason: "no_doctype" };
  }
  if (!lower.endsWith("</html>")) {
    return { ok: false, reason: "no_close_tag" };
  }
  if (html.length < 500) {
    return { ok: false, reason: "too_short" };
  }

  // Skip count check if expectedCount is 0 (legacy callers).
  if (opts.expectedCount === 0) return { ok: true };

  // Count top-level elements per product type.
  let actualCount = 0;
  if (opts.product === "site") {
    actualCount = (html.match(/<section\b/gi) || []).length;
  } else if (opts.product === "presentation") {
    // Slides marked as <section class="slide"> per the system prompt;
    // some Claude variants drop the class and just use <section>. Try
    // class first, fall back to top-level <section> count.
    const classMatches = (html.match(/<section[^>]*\bclass=["'][^"']*\bslide\b/gi) || []).length;
    actualCount = classMatches > 0 ? classMatches : (html.match(/<section\b/gi) || []).length;
  } else {
    // product-cards: each card is typically a <div> in a grid wrapper.
    // Count <img src="{{IMAGE_N}}"> instead — that's 1:1 with cards.
    actualCount = (html.match(/\{\{IMAGE_\d+\}\}/g) || []).length;
  }

  const tolerance = 2;
  if (Math.abs(actualCount - opts.expectedCount) > tolerance) {
    return { ok: false, reason: "wrong_count", actualCount };
  }
  return { ok: true, actualCount };
}

export function substituteImagePlaceholders(
  html: string,
  images: Map<string, string>,
): string {
  let out = html;
  for (const [token, dataUrl] of images) {
    if (!dataUrl) continue;
    const re = new RegExp(`\\{\\{${token}\\}\\}`, "g");
    out = out.replace(re, dataUrl);
  }
  return out;
}
