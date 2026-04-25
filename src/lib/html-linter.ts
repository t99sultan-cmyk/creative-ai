/**
 * Deterministic post-generation HTML linter — runs on the server right
 * after Claude returns HTML, before we save the creative. Catches a
 * narrow set of problems that are 100% identifiable from the source
 * (no rendering needed): banned fonts, raw decorative emoji, inline
 * style="" leaks, suspiciously duplicated text blocks, etc.
 *
 * If any high-severity issues are found, the caller can decide to
 * either (a) regenerate with a repair prompt, or (b) just log them
 * for now to build telemetry on how often they occur.
 *
 * Zero external deps. Pure regex + string ops.
 */

export type LintIssue = {
  code: string;
  severity: "high" | "low";
  message: string;
  hint: string;
};

const BANNED_FONTS = [
  "Inter",
  "Roboto",
  "Arial",
  "Helvetica",
  "Open Sans",
  "Montserrat",
  "Poppins",
  "Lato",
];

// Emoji codepoint ranges — covers most decorative emoji we want to
// catch (fire, sparkle, hearts, generic symbols). Doesn't catch every
// codepoint, but covers the slop offenders.
const EMOJI_REGEX =
  /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}]/u;

export function lintCreativeHtml(html: string): LintIssue[] {
  const issues: LintIssue[] = [];
  if (!html || typeof html !== "string") return issues;

  // 1. Banned default fonts. Match font-family declarations or Google
  //    Fonts URLs.
  for (const font of BANNED_FONTS) {
    const fontFamily = new RegExp(
      `font-family\\s*:[^;]*['"]?${font}['"]?`,
      "i",
    );
    const googleFontsImport = new RegExp(
      `fonts\\.googleapis\\.com[^"']*${font.replace(/\s+/g, "\\+?")}`,
      "i",
    );
    if (fontFamily.test(html) || googleFontsImport.test(html)) {
      issues.push({
        code: "banned_font",
        severity: "low",
        message: `Используется generic шрифт "${font}" — он считается "AI default" и удешевляет креатив.`,
        hint: `Замени "${font}" на distinctive pair: Söhne+IBM Plex Mono, Editorial New+ABC Diatype, Migra+Suisse, Tobias+Inter Display, Bricolage Grotesque, Unbounded.`,
      });
    }
  }

  // 2. Decorative emoji in user-visible text. Skip <script> blocks
  //    (someone might have legitimate emoji in JS strings for a brief).
  const userTextOnly = stripTags(html, ["script", "style"]);
  if (EMOJI_REGEX.test(userTextOnly)) {
    const sample = (userTextOnly.match(EMOJI_REGEX) || [])
      .slice(0, 3)
      .join(" ");
    issues.push({
      code: "decorative_emoji",
      severity: "high",
      message: `В креативе есть декоративные эмодзи (${sample}…).`,
      hint: "Убери все эмодзи из бейджей, заголовков, кнопок и описаний — они выглядят дёшево. Замени на крепкую типографику или иконки SVG.",
    });
  }

  // 3. Inline style="" usage. Tailwind utility classes are encouraged;
  //    one-off inline styles defeat the cache-friendly system prompt
  //    and often introduce overlap/positioning bugs.
  const inlineStyleCount = (html.match(/<[^>]+\sstyle\s*=/gi) || []).length;
  if (inlineStyleCount > 5) {
    issues.push({
      code: "inline_style_overuse",
      severity: "low",
      message: `Найдено ${inlineStyleCount} инлайн style="" — чаще всего это симптом chaotic-positioning.`,
      hint: "Перенеси стили в <style> блок и используй Tailwind utility classes. Это сделает layout предсказуемым и убирает overlap-баги.",
    });
  }

  // 4. Duplicate large text blocks — catches the "two СЕРТИФИКАТ 5000
  //    tickets stacked" problem. We look at all text-bearing block
  //    elements (h1-h3, button, p) and flag exact matches with
  //    significant length.
  const blockTexts = extractBlockTexts(html);
  const seen = new Map<string, number>();
  for (const text of blockTexts) {
    const norm = text.trim().replace(/\s+/g, " ");
    if (norm.length < 8) continue;
    seen.set(norm, (seen.get(norm) ?? 0) + 1);
  }
  for (const [text, count] of seen.entries()) {
    if (count > 1) {
      issues.push({
        code: "duplicated_block",
        severity: "high",
        message: `Текстовый блок "${text.slice(0, 60)}${text.length > 60 ? "…" : ""}" встречается ${count} раз.`,
        hint: "Один и тот же текст продублирован — оставь только одну копию. Скорее всего это причина налезания текста на текст.",
      });
    }
  }

  // 5. Inline SVG of a "person" / "human figure". We don't have a real
  //    classifier — but a strong indicator is an SVG with both a
  //    "head circle" (<circle r=…>) and "body/limb path" patterns
  //    inside the same <svg>. Cheap heuristic, doesn't catch every
  //    case but flags the common Corporate Memphis output.
  const svgBlocks = html.match(/<svg[\s\S]*?<\/svg>/gi) || [];
  for (const svg of svgBlocks) {
    if (svg.length < 800) continue; // tiny svgs are icons, not figures
    const hasHead = /<circle\b[^>]*\br\s*=\s*["']?\s*(1[5-9]|[2-9]\d|1\d{2})/i.test(svg);
    const hasBody = /<path\s+[^>]*\bd\s*=\s*"[Mm][^"]{120,}"/.test(svg);
    if (hasHead && hasBody) {
      issues.push({
        code: "vector_human",
        severity: "high",
        message: "Большой inline SVG похож на cartoon-человечка (Corporate Memphis-стиль).",
        hint: "Удали SVG-человека и замени крупной типографикой / абстрактной геометрией. Реальные люди только из загруженных юзером фото.",
      });
      break;
    }
  }

  return issues;
}

/** Strip the contents (and tags) of given block names, leaving the rest. */
function stripTags(html: string, blockNames: string[]): string {
  let out = html;
  for (const name of blockNames) {
    const re = new RegExp(`<${name}\\b[^>]*>[\\s\\S]*?<\\/${name}>`, "gi");
    out = out.replace(re, " ");
  }
  return out;
}

/** Pull text content of common headline / cta block elements. */
function extractBlockTexts(html: string): string[] {
  const out: string[] = [];
  const re = /<(h1|h2|h3|button|p)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const inner = m[2].replace(/<[^>]+>/g, "").trim();
    if (inner) out.push(inner);
  }
  return out;
}

/** Format issues for inclusion in a repair prompt. */
export function formatIssuesForRepair(issues: LintIssue[]): string {
  if (issues.length === 0) return "";
  const lines = issues.map(
    (i) => `  - [${i.severity.toUpperCase()}] ${i.message}\n    ИСПРАВИТЬ: ${i.hint}`,
  );
  return `Найденные дефекты в твоём предыдущем outputе:\n${lines.join("\n")}\n\nПеределай так, чтобы НИ ОДИН из этих дефектов не повторялся.`;
}
