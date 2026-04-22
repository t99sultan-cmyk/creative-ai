// Local preview tool: hits Claude API directly with the SAME system prompt
// as /api/generate, for a list of test prompts. Saves each creative's HTML
// to scripts/test-output/ so you can open them in a browser to see whether
// the new Library Arsenal (Three, Matter, tsParticles, Pixi, Lottie,
// SplitType) is actually being used.
//
// Usage:
//   node --env-file=.env.local scripts/test-prompts.mjs
//
// Requires: ANTHROPIC_API_KEY in .env.local.
// Does NOT spend impulses, does NOT hit Clerk, does NOT render video.

// Minimal .env.local parser so we don't depend on dotenv AND don't trip
// over node's native --env-file which leaves quoted values quoted.
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, 'test-output');
const ENV_PATH = join(__dirname, '..', '.env.local');

// Load .env.local ourselves — strips surrounding quotes, handles comments,
// ignores blank lines. Sets into process.env so the rest of the script
// can just do process.env.ANTHROPIC_API_KEY.
async function loadEnv() {
  try {
    const raw = await readFile(ENV_PATH, 'utf-8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1);
      // Strip matching surrounding quotes.
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch (e) {
    console.warn(`Could not read ${ENV_PATH}:`, e.message);
  }
}
await loadEnv();

const TEST_PROMPTS = [
  {
    slug: '1-3d-perfume',
    format: '9:16',
    isAnimated: true,
    prompt: 'Премиум флакон духов вращается в кинематографичной 3D-сцене с мягким светом и тенью. Золотой акцент, тёплые тона.',
  },
  {
    slug: '2-physics-price',
    format: '9:16',
    isAnimated: true,
    prompt: 'Ценник со скидкой -50% качается на пружине слева направо. Сверху падают буквами слова "СКИДКА ДНЯ". Динамичная атмосфера.',
  },
  {
    slug: '3-gold-confetti',
    format: '1:1',
    isAnimated: true,
    prompt: 'Взрыв золотых искр и конфетти в момент показа цены 490 ₸. Премиальная атмосфера, чёрный фон, золото и белый текст.',
  },
  {
    slug: '4-char-reveal',
    format: '9:16',
    isAnimated: true,
    prompt: 'Хук "ИИ создаст ВАШУ рекламу за 60 секунд" появляется буквами одна за одной в стиле Apple keynote. Минимализм, белый фон, чёрный типограф.',
  },
  {
    slug: '5-glitch-tech',
    format: '9:16',
    isAnimated: true,
    prompt: 'Технологичный креатив про AI-агентство с лёгким RGB-glitch на логотипе в момент появления. Неоново-фиолетовые акценты, киберпанк-настроение.',
  },
];

// -------------------------------------------------------------------------
// System prompt — COPIED VERBATIM from src/app/api/generate/route.ts so
// the local preview matches what production would actually produce.
// If you change the production prompt, re-sync this file.
// -------------------------------------------------------------------------
function buildSystemPrompt({ format, isAnimated }) {
  return `You are an absolute elite, award-winning Frontend Developer & UI/UX Designer.
Your task is to generate an incredibly beautiful, modern, and production-ready HTML document representing an ADVERTISEMENT BANNER / CREATIVE based on the user's request.

CRITICAL INSTRUCTIONS (FAILURE IS NOT AN OPTION):
1. Return ONLY raw HTML code. NO markdown formatting (\`\`\`html), NO explanations. Just start with <!DOCTYPE html> and end with </html>.
2. Single File: All HTML, CSS (<style>), and JS (<script>) must be in one file.
3. Libraries — "Creative Arsenal" via CDN:

   🔴 ALWAYS LOAD (mandatory):
   - Tailwind CSS: <script src="https://cdn.tailwindcss.com"></script>
   - Modern Google Fonts
   - ${isAnimated ? 'GSAP: <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>' : 'No animation libs.'}

   ${isAnimated ? `🟢 OPT-IN LIBS (CDN URLs):
   • SplitType — https://cdn.jsdelivr.net/npm/split-type@0.3.4/umd/index.min.js
   • Three.js  — https://cdn.jsdelivr.net/npm/three@0.169/build/three.min.js
   • Matter.js — https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.20.0/matter.min.js
   • tsParticles — https://cdn.jsdelivr.net/npm/@tsparticles/slim@3/tsparticles.slim.bundle.min.js
   • Pixi.js — https://pixijs.download/v8.6.6/pixi.min.js
   • Lottie — https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js

   🔴 HARD TRIGGERS — if user prompt contains these keywords, MUST load the lib.
   Do NOT substitute with GSAP alone — GSAP cannot replicate these effects.

   | Keyword                                              | Required lib      |
   | "3D", "объём", "перспектива", "depth", "parallax"    | Three.js          |
   | "физика", "пружина", "отскок", "падают буквами",     | Matter.js         |
   |  "physics", "bounce", "gravity", "springy"           |                   |
   | "конфетти", "искры", "частицы", "снег", "pyl*",      | tsParticles       |
   |  "confetti", "sparkle", "particles", "dust"          |                   |
   | "glitch", "глитч", "искажение", "RGB split",          | Pixi.js           |
   |  "displacement", "ripple", "distortion"              |                   |
   | "lottie", "галочка анимац*", "иконка AE"              | Lottie Web        |
   | "побуквенно", "буквы появляются", "char reveal",     | SplitType         |
   |  "typewriter"                                         |                   |

   BUDGET (soft rules after triggers are honored):
   - Trigger libs are MANDATORY when keyword matches.
   - Additional libs beyond triggers: cap 2 extras.
   - NEVER Three + Pixi (both WebGL). NEVER Matter + tsParticles.
   - If you load a lib, USE it so it affects the render.

   EXAMPLES:
   - "3D флакон вращается" → MUST load Three.js + GSAP.
   - "ценник на пружине" → MUST load Matter.js + GSAP.
   - "взрыв конфетти" → MUST load tsParticles + GSAP.
   - "RGB glitch" → MUST load Pixi.js + GSAP.` : ''}

4. FORMAT: ${format}. ${format === '9:16' ? '9:16 vertical, 1080x1920 target. Hook top, product center, CTA bottom.' : '1:1 square, 1080x1080.'}

5. BEAUTIFUL LAYOUT:
   - Use Flexbox/Grid, generous padding, breathable whitespace.
   - NO fake Instagram UI, no generic "Подробнее" buttons.
   - Highlight 3-5 power words with vibrant color.
   - Lock viewport: \`html,body { width:100vw; height:100vh; margin:0; overflow:hidden; }\`

${isAnimated ? `6. ANIMATIONS — video is ${format === '9:16' ? '15' : '10'} seconds at 30 fps:
   - NO ease: linear. Use power3.out, expo.out, sine.inOut, cubic-bezier(0.22, 1, 0.36, 1).
   - Only animate transform and opacity (GPU-cheap). Add will-change.
   - Overlap tweens with negative offsets ("-=0.6") for continuous motion.
   - Keep ONE subtle ambient loop on the hold so frame never looks frozen.
   - No fast-spinning loaders. Decorative rotation must be 8-15s per turn.
   - Single-pass easings 1.5-3s. If repeat:-1 + yoyo:true, pick duration so at most 2-4 cycles over full video.

   Template:
   const tl = gsap.timeline({ repeat: -1, yoyo: true, defaults: { ease: "power3.out" } });
   tl.from(".title", { y: 40, opacity: 0, duration: 1.4 });
   tl.from(".product", { scale: 0.85, opacity: 0, duration: 1.3, ease: "expo.out" }, "-=0.7");
   tl.to(".product", { y: "-=10", duration: 3, ease: "sine.inOut", yoyo: true, repeat: 1 }, "+=0.3");
   tl.to({}, { duration: ${format === '9:16' ? '4' : '2'} });` : '6. STATIC image. No animations, no GSAP.'}
`;
}

async function generateOne(test) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');

  const systemPrompt = buildSystemPrompt({ format: test.format, isAnimated: test.isAnimated });
  const userText = `Format required: ${test.format}.\n\nTask (ТЗ): ${test.prompt}`;

  const started = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-7',
      system: systemPrompt,
      max_tokens: 8192,
      messages: [{ role: 'user', content: [{ type: 'text', text: userText }] }],
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Claude ${res.status}: ${t.slice(0, 400)}`);
  }

  const data = await res.json();
  let html = data.content?.[0]?.text ?? '';
  const match = html.match(/```(?:html)?\s*([\s\S]*?)```/);
  if (match) html = match[1];

  const inTok = data.usage?.input_tokens ?? 0;
  const outTok = data.usage?.output_tokens ?? 0;
  const costUsd = (inTok / 1_000_000) * 15 + (outTok / 1_000_000) * 75;

  return { html, elapsedMs: Date.now() - started, inTok, outTok, costUsd };
}

// Detect which opt-in libs the HTML actually loaded.
function detectLibs(html) {
  const hits = [];
  if (/cdn\.tailwindcss\.com/.test(html)) hits.push('tailwind');
  if (/gsap(?:\.min)?\.js|cdnjs.*gsap/.test(html)) hits.push('gsap');
  if (/split-type/.test(html)) hits.push('split-type');
  if (/three(?:\.min)?\.js|cdn\.jsdelivr.*three/.test(html)) hits.push('three');
  if (/matter(?:-js)?(?:\.min)?\.js|cdnjs.*matter/.test(html)) hits.push('matter-js');
  if (/tsparticles/.test(html)) hits.push('tsparticles');
  if (/pixi(?:js)?(?:\.min)?\.js|pixijs\.download/.test(html)) hits.push('pixi');
  if (/lottie(?:-web|-player)?(?:\.min)?\.js/.test(html)) hits.push('lottie');
  return hits;
}

// ----- main -----
await mkdir(OUTPUT_DIR, { recursive: true });
console.log(`\nRunning ${TEST_PROMPTS.length} tests in parallel...\n`);

const startAll = Date.now();
const results = await Promise.all(
  TEST_PROMPTS.map(async (t) => {
    try {
      const r = await generateOne(t);
      const outPath = join(OUTPUT_DIR, `${t.slug}.html`);
      await writeFile(outPath, r.html, 'utf-8');
      const libs = detectLibs(r.html);
      return { ...t, ok: true, ...r, libs, outPath };
    } catch (e) {
      return { ...t, ok: false, error: e.message };
    }
  }),
);
const totalSec = ((Date.now() - startAll) / 1000).toFixed(1);

// ----- report -----
console.log('─'.repeat(80));
console.log('RESULTS');
console.log('─'.repeat(80));
let totalCost = 0;
for (const r of results) {
  if (!r.ok) {
    console.log(`\n❌ ${r.slug}  —  ${r.error}`);
    continue;
  }
  totalCost += r.costUsd;
  const libStr = r.libs.length ? r.libs.join(', ') : '(none — failed)';
  const sizeKB = (r.html.length / 1024).toFixed(1);
  console.log(`\n✅ ${r.slug}  [${r.format}]`);
  console.log(`   Prompt: ${r.prompt.slice(0, 80)}${r.prompt.length > 80 ? '…' : ''}`);
  console.log(`   Time:   ${(r.elapsedMs / 1000).toFixed(1)}s  |  Tokens: ${r.inTok} in / ${r.outTok} out  |  Cost: $${r.costUsd.toFixed(3)}`);
  console.log(`   Libs:   ${libStr}`);
  console.log(`   Size:   ${sizeKB} KB`);
  console.log(`   File:   ${r.outPath}`);
}

console.log('\n' + '─'.repeat(80));
console.log(`Total elapsed: ${totalSec}s  |  Total cost: $${totalCost.toFixed(3)} (~${Math.round(totalCost * 480)} ₸)`);
console.log('─'.repeat(80));
console.log('\nOpen any HTML file in your browser to preview:');
for (const r of results.filter((x) => x.ok)) {
  console.log(`   open ${r.outPath}`);
}
console.log('');
