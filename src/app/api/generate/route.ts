import { NextResponse } from 'next/server';
import { db } from "@/db";
import { users, creatives } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import crypto from "crypto";
import { checkGenerateRateLimit, rateLimitMessage } from "@/lib/rate-limit";
import { isAdmin } from "@/lib/admin-guard";
import { SIGNUP_BONUS_IMPULSES } from "@/lib/pricing";
import { getNichePack } from "@/lib/niche-packs";
import { lintCreativeHtml } from "@/lib/html-linter";

export const maxDuration = 300;

// ---- Input validation limits ----
// These protect Claude-budget and API-call size.
const MAX_PROMPT_LEN = 4000; // chars
const MAX_REF_IMAGES = 4;
const MAX_PRODUCT_IMAGES = 4;
// Claude accepts base64 up to ~5 MB per image; we cap per-request total.
const MAX_TOTAL_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB across all images
// Raw remix HTML can carry several MB of embedded base64 product images.
// We strip those out below (base64Regex → REMIX_PRESERVED_IMG_N) before
// sending to Claude, so the effective Claude payload is small. This cap is
// just a sanity check on the raw request.
const MAX_REMIX_HTML_LEN = 10_000_000; // chars

function approxBase64Bytes(dataUrlOrBase64: string): number {
  if (typeof dataUrlOrBase64 !== "string") return 0;
  const idx = dataUrlOrBase64.indexOf(",");
  const b64 = idx >= 0 ? dataUrlOrBase64.slice(idx + 1) : dataUrlOrBase64;
  // base64 -> bytes: length * 3/4, minus padding
  return Math.floor((b64.length * 3) / 4);
}

export async function POST(req: Request) {
  // `deductedCost` is read in the catch block for refund. It must be declared
  // outside the try so it's in scope there. We set it > 0 only AFTER a
  // successful atomic deduct, so a pre-deduct failure never triggers refund.
  let deductedUserId: string | null = null;
  let deductedCost = 0;
  try {
    const { userId } = await auth();
    if (!userId) {
       return new Response(JSON.stringify({ error: "Не авторизован" }), { status: 401 });
    }

    const body = await req.json();
    const { prompt, isAnimated, format, referenceImagesBase64, productImagesBase64, remixHtmlCode, remixScreenshotBase64, strictClone, niche, modelChoice } = body;
    // modelChoice: 'claude' (default) | 'gemini'. Claude Opus 4.7 is the
    // recommended path — best quality on HTML/CSS generation. Gemini
    // 3.1 Pro is the alternative — ~5× cheaper, faster, but lower
    // visual fidelity on complex layouts. We expose both so the user
    // can compare.
    const useGemini = modelChoice === "gemini";

    // ---- Input validation ----
    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Промпт не может быть пустым." }), { status: 400 });
    }
    if (prompt.length > MAX_PROMPT_LEN) {
      return new Response(
        JSON.stringify({ error: `Промпт слишком длинный (${prompt.length} симв., максимум ${MAX_PROMPT_LEN}).` }),
        { status: 400 }
      );
    }
    if (format !== "9:16" && format !== "1:1") {
      return new Response(JSON.stringify({ error: "Неверный формат. Ожидается 9:16 или 1:1." }), { status: 400 });
    }
    const refs = Array.isArray(referenceImagesBase64) ? referenceImagesBase64 : [];
    const prods = Array.isArray(productImagesBase64) ? productImagesBase64 : [];
    if (refs.length > MAX_REF_IMAGES) {
      return new Response(JSON.stringify({ error: `Максимум ${MAX_REF_IMAGES} референсных изображений.` }), { status: 400 });
    }
    if (prods.length > MAX_PRODUCT_IMAGES) {
      return new Response(JSON.stringify({ error: `Максимум ${MAX_PRODUCT_IMAGES} фото продукта.` }), { status: 400 });
    }
    let totalImgBytes = 0;
    for (const img of [...refs, ...prods]) totalImgBytes += approxBase64Bytes(img);
    if (remixScreenshotBase64) totalImgBytes += approxBase64Bytes(remixScreenshotBase64);
    if (totalImgBytes > MAX_TOTAL_IMAGE_BYTES) {
      return new Response(
        JSON.stringify({
          error: `Слишком большой объём изображений (${(totalImgBytes / 1024 / 1024).toFixed(1)} МБ). Максимум ${(MAX_TOTAL_IMAGE_BYTES / 1024 / 1024).toFixed(0)} МБ.`,
        }),
        { status: 413 }
      );
    }
    if (typeof remixHtmlCode === "string" && remixHtmlCode.length > MAX_REMIX_HTML_LEN) {
      return new Response(
        JSON.stringify({ error: `Слишком большой HTML в remix-контексте (${remixHtmlCode.length} симв.).` }),
        { status: 413 }
      );
    }

    // ---- Rate limit (admins bypass) ----
    const adminBypass = await isAdmin();
    if (!adminBypass) {
      const rl = await checkGenerateRateLimit(userId);
      if (!rl.ok) {
        return new Response(
          JSON.stringify({ error: rateLimitMessage(rl), rateLimit: rl }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(rl.retryAfterSec),
            },
          }
        );
      }
    }

    // Animated creatives cost 4 impulses (video render in Cloud Run is
    // expensive), static ones cost 3. The schema comment on `creative.cost`
    // documents this convention — previously cost was hardcoded to 3
    // regardless, which broke every UI path that relied on `cost > 3` to
    // identify animated creatives (e.g. history modal, download button).
    const cost = isAnimated ? 4 : 3;

    // ---- Lazy-create the user row on first generation (from Clerk). ----
    const userRecords = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (userRecords.length === 0) {
      const resp = await fetch("https://api.clerk.com/v1/users/" + userId, {
        headers: { Authorization: "Bearer " + process.env.CLERK_SECRET_KEY }
      });
      if (resp.ok) {
        const clerkUser = await resp.json();
        await db.insert(users).values({
          id: userId,
          email: clerkUser.email_addresses[0].email_address,
          name: clerkUser.first_name || "Пользователь",
          impulses: SIGNUP_BONUS_IMPULSES,
        });
      }
    }

    // ---- Atomic deduct-upfront (fixes race condition on concurrent requests). ----
    // We UPDATE with a DB-side `impulses - cost` expression AND a WHERE guard
    // that only matches when the current balance is still >= cost. If two
    // requests race, only one WHERE matches; the other gets an empty result
    // and we reject with 400 BEFORE spending real money on the Claude API.
    //
    // If the Claude call (or anything below) fails, the catch block at the
    // bottom refunds `deductedCost` back to the user.
    const deducted = await db.update(users)
      .set({ impulses: sql`${users.impulses} - ${cost}` })
      .where(and(eq(users.id, userId), gte(users.impulses, cost)))
      .returning({ impulses: users.impulses });

    if (deducted.length === 0) {
      return new Response(
        JSON.stringify({ error: "Недостаточно импульсов на балансе. Пожалуйста, пополните счет." }),
        { status: 400 }
      );
    }

    deductedUserId = userId;
    deductedCost = cost;

    // Improved System instruction for elite Generative UI generation
    const systemPrompt = `You are an absolute elite, award-winning Frontend Developer & UI/UX Designer.
Your task is to generate an incredibly beautiful, modern, and production-ready HTML document representing an ADVERTISEMENT BANNER / CREATIVE based on the user's request.

CRITICAL INSTRUCTIONS (FAILURE IS NOT AN OPTION):
1. Return ONLY raw HTML code. NO markdown formatting (\`\`\`html), NO explanations. Just start with <!DOCTYPE html> and end with </html>.
2. Single File: All HTML, CSS (<style>), and JS (<script>) must be in one file.
3. Libraries — "Creative Arsenal" via CDN:

   🔴 ALWAYS LOAD (these are mandatory):
   - Tailwind CSS: <script src="https://cdn.tailwindcss.com"></script>
   - Modern Google Fonts (e.g. Inter, Manrope, Unbounded, Space Grotesk, Bricolage Grotesque)
   - ${isAnimated ? 'GSAP (baseline animation engine): <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>' : 'No animation libs — OFF mode.'}

   ${isAnimated ? `🟢 OPT-IN LIBS (load ONLY when the concept needs them, max 2-3 extras per creative to keep render time reasonable):

   • **SplitType** — per-letter / per-word text reveal (for cinematic headline entrances).
     <script src="https://cdn.jsdelivr.net/npm/split-type@0.3.4/umd/index.min.js"></script>
     Use when: the hero text should stagger letter-by-letter.
     Example: \`const split = new SplitType(".title", { types: "chars" });
              gsap.from(".title .char", { y: 40, opacity: 0, duration: 0.8, stagger: 0.03, ease: "power3.out" });\`

   • **Three.js + drei helpers** — 3D perspective, product orbiting on a ring, tilted planes, parallax.
     <script src="https://cdn.jsdelivr.net/npm/three@0.169/build/three.min.js"></script>
     (No react-three-fiber in the iframe — use vanilla Three.js with WebGLRenderer appended to a <canvas>.)
     Use when: concept calls for depth, rotating product showcase, dramatic lighting, floating cards in 3D space.
     Keep scene simple: one product image on a plane, one directional light, one ambient. Don't import drei.

   • **Matter.js** — 2D physics: text letters falling with bounce, price tag swinging on a pin, confetti with gravity.
     <script src="https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.20.0/matter.min.js"></script>
     Use when: product or badge should "drop into frame" with real physics, or letters pile up.
     Only use Matter if the concept genuinely calls for physical motion — otherwise GSAP is cheaper.

   • **tsParticles** — snow, sparks, gold confetti, magical dust, background bokeh.
     <script src="https://cdn.jsdelivr.net/npm/@tsparticles/slim@3/tsparticles.slim.bundle.min.js"></script>
     Use when: celebrating a discount (confetti), premium feel (gold particles), winter mood (snow).
     Init with \`tsParticles.load({ id: "particles", options: { ... } });\` targeting an absolute-positioned canvas.

   • **Pixi.js** — GPU-accelerated 2D shader effects: glitch, displacement (water/heat), RGB split, chromatic aberration.
     <script src="https://pixijs.download/v8.6.6/pixi.min.js"></script>
     Use when: brand wants an edgy / tech / distortion feel. Heavy — ONLY when glitch/displacement is actually the hook.

   • **Lottie Web** — pre-made vector animations from After Effects (check-marks, rockets, coin drops, loading spinners THAT ARE PART OF THE CONCEPT not decoration).
     <script src="https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js"></script>
     Use when: user asks for a specific iconographic animation (fire, star, tick). Load JSON from lottiefiles.com URL — NEVER embed large JSON inline.

   🔴 HARD TRIGGERS — when the user's prompt contains ANY of these keywords
   (Russian or English), you MUST load and meaningfully use the matching lib.
   Do NOT substitute with GSAP-only — GSAP cannot replicate these effects.

   | Keyword in prompt                                    | Required lib      |
   |------------------------------------------------------|-------------------|
   | "3D", "3d", "объём", "объем", "перспектива",          | Three.js          |
   |  "вращ*ется в пространстве", "depth", "parallax"     |                   |
   | "физика", "пружин*", "отскок", "падают буквами",     | Matter.js         |
   |  "physics", "bounce", "gravity", "springy"           |                   |
   | "конфетти", "искры", "частицы", "снег", "пыльца",    | tsParticles       |
   |  "confetti", "sparkle", "particles", "dust"          |                   |
   | "glitch", "глитч", "искажение", "rgb split",          | Pixi.js           |
   |  "displacement", "water ripple", "heat distortion"   |                   |
   | "lottie", "галочка анимация", "ракета", "иконка AE"  | Lottie Web        |
   | "побуквенно", "буквы появляются", "per-letter",       | SplitType         |
   |  "char reveal", "typewriter"                          |                   |

   🟠 LIB BUDGET:
   - Trigger libs are MANDATORY when keyword matches — no budget excuse.
   - Additional libs (beyond triggers) — cap at 2 extras.
   - Simple product reveal without any trigger → GSAP alone is fine.
   - NEVER load both Three and Pixi in the same creative (both WebGL, conflict).
   - NEVER load Matter AND tsParticles together (pick ONE motion source).
   - If you load a lib, you MUST call its API in a way that affects the rendered output.
     Loading a 200 KB script and not using it is a failure.

   🔴 EXAMPLES of correct behavior:
   - Prompt "3D флакон вращается" → MUST load Three.js + GSAP. Show product on a plane or cube with rotation.
   - Prompt "ценник качается на пружине" → MUST load Matter.js + GSAP. Real constraint-based swing.
   - Prompt "взрыв конфетти" → MUST load tsParticles + GSAP. Particle burst with gold/amber colors.
   - Prompt "RGB glitch" → MUST load Pixi.js + GSAP. DisplacementFilter or RGB split filter.
   - Prompt "минималистичный продуктовый постер" (no trigger) → GSAP alone, clean & fast.` : ''}
4. STRICT BAN ON SOCIAL MEDIA UI & EXTERNAL BUTTONS:
   - Generate the ACTUAL promotional banner. DO NOT include fake Instagram UI (no comments, no avatars).
   - DO NOT generate external link buttons like "Подробнее", "Узнать подробнее", or "Перейти", because social media ad platforms natively overlay their own link buttons over the creative.

5. BEAUTIFUL LAYOUT & BRANDING AWARENESS (CRITICAL):
   - You have FULL CREATIVE FREEDOM to make it look stunning.

   🎨 ANTI-AI-SLOP MANIFESTO (read this every time):
   You have a strong tendency to converge toward generic, "on distribution"
   ad creatives — purple-to-blue gradients, Inter or Roboto everywhere,
   pastel mush, centered headline + CTA stacked below, soft rounded
   gradient cards, sparkle/shimmer overlays. This is "AI slop" and it
   does NOT sell. The user's brand will look like every other AI-output.
   Avoid this aggressively.

   ❌ BANNED defaults (do NOT reach for these):
   - Fonts: Inter, Roboto, Arial, system-ui, Helvetica, Open Sans,
     Montserrat, Poppins. These are the "AI defaults" and signal cheap.
   - Color: purple→blue gradients, pastel rainbows, neon mint/lavender
     combinations without commitment. No "Stripe gradient" rainbows.
   - Layout: centered logo on top + headline center + CTA below pattern.
     Stock-feel rounded card with soft shadow as the dominant element.
   - Decoration: sparkle ✨ overlays, circular dotted patterns,
     floating geometric pastels, generic "tech-y" mesh gradients.
   - Texture: same flat fill everywhere; no shadows, no noise, no depth.

   ✅ AIM HIGHER:
   - Typography: pick a DISTINCTIVE pair — display + body with clear
     contrast in personality. Good pairs: Söhne + IBM Plex Mono,
     Editorial New + ABC Diatype, Migra + Suisse Int'l, Tobias +
     Inter Display, Bricolage Grotesque + Söhne Mono, Unbounded +
     Manrope, Space Grotesk + JetBrains Mono. Use Google Fonts CDN
     to load them. Display font should have personality (slab,
     condensed, expanded, editorial, monospace).
   - Color: COMMIT to a palette via CSS custom properties. ONE dominant
     hue + ONE sharp accent + neutrals. Reference real-world editorial
     palettes (Aesop, Hermès, Nike SB, Loewe, Patagonia, Off-White).
     Use OKLCH or hand-picked HEX. NO generic "tailwind blue-500".
   - Layout: pick a defined ARCHETYPE — split-screen, asymmetric grid,
     bento, vertical stack with offset, magazine spread, full-bleed
     image with corner caption. Avoid "centered everything".
   - Depth: layered backgrounds (gradient + grain texture + soft blur
     blob OR solid + sharp geometric primitive). Real shadows
     (drop-shadow, not box-shadow on rectangles). Subtle noise
     overlay via SVG turbulence or repeating-radial-gradient.
   - Hierarchy: ONE focal element wins. Typography scale ratio 1.5-1.8
     between hero and body. No four-equal-weights.
   - Variation: alternate light/dark backgrounds and font families
     across generations of the same brief — don't fall into one mold.

   - 🔴 NO UNREQUESTED CLIP ART: DO NOT hallucinate or generate literal SVG/emoji representations of brand names! If the brand is "Золотое Яблоко", do NOT draw literal apples. If it's "Tiger", do not draw a tiger. Your visual decorations should be abstract, geometric, elegant, CSS gradients, or typography-focused. The user's provided PRODUCT IMAGES are the ONLY real-world objects you should display.
   - 🔴 BUILD ROBUST LAYOUTS: DO NOT rely on haphazard absolute positioning that causes text to overlap with other elements. USE modern CSS Flexbox and CSS Grid. Create structured layouts where elements flow naturally.
   - 🔴 PREVENT OVERLAPS & TIGHT SPACING (CRITICAL): Never let text, badges, checkmarks, or list items overlap with or tightly hug the central graphics/products! Always use generous padding (\`p-4\`), margins (\`m-4\`), and rich flex/grid gaps (\`gap-6\` or \`gap-8\`). Elements placed around a central visual MUST be pushed outwards so they maintain clean, breathable white space around the visual.
   - 🔴 NO TEXT-ON-TEXT (HARD BAN): Two text blocks must NEVER cross or partially cover each other. Headlines, prices, certificates, badges — each gets its OWN slot in the grid. If you create a "ticket" or "voucher" element, place it in a single dedicated row/column. NEVER duplicate the same element (e.g. two "СЕРТИФИКАТ 5000" tickets stacked) — one is enough. Before finalizing, mentally check: "if I read every word top-to-bottom, does any character fall on top of another character?" If yes — refactor.
   - 🔴 NO DECORATIVE EMOJI: DO NOT inject emojis (🔥 ✨ 💪 🎁 🚀 ⭐ 💯 etc.) as decorative elements inside badges, buttons, or labels unless the user prompt explicitly asks for them. They look cheap, mobile-toy-like, and undermine premium brand perception. Replace with crisp typography, clean geometric shapes, or proper icon SVGs (line-style, single weight, brand-color stroke).
   - 🔴 NO FLAT VECTOR PEOPLE / CHARACTERS: DO NOT draw stylized human figures, mascots, or character illustrations in inline SVG (the "Corporate Memphis" / "flat vector person" look). They scream "stock illustration" and don't sell. If you need a hero visual and the user has NOT provided a product/person photo, lean on bold typography, gradient blobs, abstract geometric compositions, or product-less brand graphics — never on cartoon-style human SVGs. The only people that should appear in the creative are real photos uploaded by the user.
   - Ensure the outer container is bounded: \`max-w-[400px] h-[100vh]\` for 9:16 vertical layouts.
   - Inject these global CSS rules into your \`<style>\` to lock the viewport: \`html, body { width: 100vw; height: 100vh; margin: 0; padding: 0; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; background-position: center; background-size: cover; }\`. Your main container wrapper inside body MUST naturally expand or flex without pushing items out of bounds.

6. FORMAT SPECIFICS:
   - The user requested aspect ratio: ${format}.
   - If 9:16: Make it vertical like a story. Keep the hook/title at the top, center empty for visuals/product, and heavily stylized captions at the bottom.
   - If 1:1: Make it a perfect square.

7. ANIMATIONS (${isAnimated ? 'ON' : 'OFF'}):
   ${isAnimated ? `- You MUST animate typography and elements beautifully using CSS keyframes or GSAP.
   - 🔴 TARGET PLAYBACK — THE FINAL VIDEO IS ${format === '9:16' ? '15 SECONDS' : '10 SECONDS'} LONG, rendered at **30 FPS**.
     Design for cinematic ad pacing, NOT a busy UI with spinning loaders.

   - 🔴 TIMING RULES:
     * Per-element entrance / exit: duration 1.5s – 3s (slow = premium).
     * If you use \`repeat: -1\` + \`yoyo: true\`, pick duration so there are AT MOST 2-4 cycles
       over the whole video. A 0.5s loop = 30 cycles = looks like a glitch.
     * Decorative rotating rings: 8-15 SECONDS per full turn (never 1s).
     * CSS @keyframes with infinite iteration: animation-duration ≥ 3s, ideally 5-10s.

   - 🔴 SMOOTHNESS (avoids jittery 30-fps look):
     * NEVER use \`ease: "linear"\` — it looks mechanical. Use curves that accelerate in and
       decelerate out: \`power2.out\`, \`power3.out\`, \`power4.out\`, \`expo.out\`, \`cubic.inOut\`,
       \`sine.inOut\`. For CSS prefer \`cubic-bezier(0.22, 1, 0.36, 1)\` (easeOutExpo).
     * ALWAYS animate GPU-cheap properties: \`transform\` (translate/rotate/scale) and \`opacity\`.
       NEVER animate \`left\`, \`top\`, \`width\`, \`height\`, \`margin\`, \`padding\`, \`filter: blur()\` —
       these are expensive and can skip frames at 30 fps.
     * Add \`will-change: transform, opacity\` on animated elements, and \`transform: translateZ(0)\`
       on their parents to force GPU compositing.
     * Overlap tweens in GSAP with negative offsets (e.g. \`"-=0.6"\`) so there is CONTINUOUS
       motion — no "hard stops" between sequential entrances.
     * On the long hold at the end, keep ONE subtle ambient animation (e.g. product image
       floating y: +8px over 4s yoyo, or background gradient slow hue-shift) so the frame never
       looks frozen.

   - 🔴 NO FAST-SPINNING / BUSY-UI LOADERS. Ever. The viewer should feel a slow elegant reveal,
     not a buffering indicator.

   - CONCRETE GSAP TEMPLATE (adapt, don't copy verbatim):
     \`const tl = gsap.timeline({ repeat: -1, yoyo: true, defaults: { ease: "power3.out" } });\`
     \`tl.from(".title",    { y: 40, opacity: 0, duration: 1.4 });\`
     \`tl.from(".subtitle", { y: 24, opacity: 0, duration: 1.2 }, "-=0.7");\`
     \`tl.from(".product",  { scale: 0.85, opacity: 0, duration: 1.3, ease: "expo.out" }, "-=0.9");\`
     \`tl.from(".cta",      { y: 20, opacity: 0, duration: 1.0 }, "-=0.5");\`
     \`tl.to(".product",    { y: "-=10", duration: 3, ease: "sine.inOut", yoyo: true, repeat: 1 }, "+=0.3");\`
     \`tl.to({},            { duration: ${format === '9:16' ? '4' : '2'} }); // final hold\`

   - IDIOMATIC PATTERNS per extra lib (use as reference when you opt in):

     SplitType + GSAP (cinematic per-letter reveal of a headline):
       \`const split = new SplitType(".hook", { types: "chars" });\`
       \`gsap.from(".hook .char", { y: 60, opacity: 0, rotateX: -90, duration: 1, stagger: 0.025, ease: "power4.out" });\`

     tsParticles (gold confetti burst behind the product):
       \`<canvas id="particles" class="absolute inset-0 z-0 pointer-events-none"></canvas>\`
       \`tsParticles.load({ id: "particles", options: { preset: "confetti", particles: { color: { value: ["#FFD700", "#F37021", "#fff"] }, number: { value: 40 } }, emitters: { position: { x: 50, y: 50 }, rate: { delay: 1.5, quantity: 10 } }, background: { color: "transparent" } } });\`

     Matter.js (price tag swinging on a pin):
       \`const { Engine, World, Bodies, Constraint, Render, Runner } = Matter;\`
       \`const engine = Engine.create(); const render = Render.create({ element: document.getElementById("physics"), engine, options: { width: 400, height: 600, wireframes: false, background: "transparent" } });\`
       \`const tag = Bodies.rectangle(200, 150, 120, 60, { render: { fillStyle: "#F37021" } });\`
       \`const pin = Constraint.create({ pointA: { x: 200, y: 50 }, bodyB: tag, stiffness: 0.02 });\`
       \`World.add(engine.world, [tag, pin]); Render.run(render); Runner.run(engine);\`

     Three.js (product floating on a tilted plane with ambient light):
       \`<canvas id="three"></canvas>\`
       \`const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100); camera.position.z = 5;\`
       \`const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("three"), alpha: true, antialias: true });\`
       \`const tex = new THREE.TextureLoader().load("PRODUCT_IMG_0"); const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true });\`
       \`const plane = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5), mat); scene.add(plane);\`
       \`scene.add(new THREE.AmbientLight(0xffffff, 0.6)); const dir = new THREE.DirectionalLight(0xffffff, 1); dir.position.set(5, 5, 5); scene.add(dir);\`
       \`function tick(t){ plane.rotation.y = Math.sin(t * 0.0008) * 0.3; plane.position.y = Math.sin(t * 0.001) * 0.1; renderer.render(scene, camera); requestAnimationFrame(tick); } requestAnimationFrame(tick);\`

     Lottie (specific iconographic animation, e.g. check-mark on success):
       \`<div id="lottie" class="w-24 h-24"></div>\`
       \`lottie.loadAnimation({ container: document.getElementById("lottie"), renderer: "svg", loop: true, autoplay: true, path: "https://assets9.lottiefiles.com/packages/lf20_obhph3sh.json" });\`

     Pixi.js (glitch / displacement on a product — use SPARINGLY):
       \`const app = new PIXI.Application(); await app.init({ resizeTo: window, backgroundAlpha: 0 });\`
       \`document.getElementById("pixi").appendChild(app.canvas);\`
       \`const img = await PIXI.Assets.load("PRODUCT_IMG_0"); const sprite = new PIXI.Sprite(img);\`
       \`app.stage.addChild(sprite);\`
       \`// Attach PIXI.DisplacementFilter for a subtle ripple, NOT a heavy glitch every frame.\`

   - 🔴 When an opt-in lib is loaded it MUST be used meaningfully in the final render.
     Loading a 200 KB script and animating only \`<h1>\` with GSAP is waste — strip the script.` : 'NO animations. Output must be ONE perfectly static visual poster/picture. DO NOT USE ANY ANIMATIONS, GSAP, or KEYFRAMES. You are designing a flat graphic image.'}

8. HIGHLIGHTS & PRODUCT INTEGRATION:
   - Highlight 3-5 power words in a vibrant color (like text-yellow-400 or a gradient).
   ${productImagesBase64 && productImagesBase64.length > 0 ? `- PRODUCT IMAGES: You MUST visually integrate these EXACT cut-out images. Use placeholders \`PRODUCT_IMG_0\`, \`PRODUCT_IMG_1\`. Example: \`<img src="PRODUCT_IMG_0" alt="Product" class="...">\`` : '- NO PRODUCTS PROVIDED. Focus 100% on beautiful typography and background.'}

${strictClone ? `9. STRICT CLONE MODE [CRITICAL]:
- EXACT ALIGNMENT & SPACING: You MUST copy the exact spatial layout, padding, and proportions of the reference image. The spacing (breathing room) around the visual and text must be identical to the reference.
- OVERLAPPING ELEMENTS: If the reference has elements (like floating badges, pills, or buttons) that overlap the boundary between an image and the background, you MUST perfectly replicate this overlap using CSS (e.g., absolute positioning, 'translate-y-[-50%]', 'z-index'). Do NOT let 'overflow-hidden' clip them off. Do not cramp them.
- EXACT COLORS & TYPOGRAPHY: You MUST strictly use the exact color palette (backgrounds, fonts, accents) and font weights seen in the reference image. DO NOT hallucinate new colors based on the product.
- Your job is to output HTML/CSS that produces a 1:1 structural copy of the reference with only the product and text swapped out.` : `9. CREATIVE FREEDOM:
- REPLICATE STRUCTURE: Carefully look at how elements (images, text, buttons) are positioned in the reference image and replicate that structural layout. DO NOT randomly scatter products.
- CHANGE CONTEXT & VIBE: You have full freedom to modify the color palette, typography style, and background decorations to perfectly match the theme/brand requested by the user, while keeping the structural skeleton of the reference.`}
`;

    const claudeContent: any[] = [];
    
    // Base64 Extract for Rate Limits
    const preservedImages: string[] = [];
    let cleanedRemixHtmlCode = remixHtmlCode;
    
    if (cleanedRemixHtmlCode) {
      // Find all huge base64 strings in data:image payload to prevent token explosion
      const base64Regex = /data:image\/[^"']+/g;
      
      cleanedRemixHtmlCode = cleanedRemixHtmlCode.replace(base64Regex, (match: string) => {
        const id = preservedImages.length;
        preservedImages.push(match);
        return `REMIX_PRESERVED_IMG_${id}`;
      });
      
      claudeContent.push({ 
        type: "text", 
        text: `Format required: ${format}.\n\nOriginal Task (ТЗ): ${prompt}\n\nIMPORTANT: THIS IS A REMIX REQUEST! The user wants to modify an existing creative.\nBelow is the previous HTML code. RE-USE this structure completely. Keep the layout, core vibe, and animations identical, but make the changes requested by the user. Return the fully updated HTML code:\n\n\`\`\`html\n${cleanedRemixHtmlCode}\n\`\`\`` 
      });

      if (remixScreenshotBase64) {
         claudeContent.push({
           type: "text",
           text: "Here is the visual rendering (screenshot) of the current HTML. Use your Vision capabilities to 'see' where elements are positioned, so you can accurately process the User's changes!"
         });
         
         let mimeType = "image/png";
         let data = remixScreenshotBase64;
         if (data.startsWith("data:")) {
            mimeType = data.split(";")[0].split(":")[1];
            data = data.split(",")[1];
         }
         claudeContent.push({
           type: "image",
           source: { type: "base64", media_type: mimeType, data: data }
         });
      }
    } else {
      // Auto-prompt enhancer: when the user typed a short, vague brief
      // and uploaded no images, we burn ~$0.005 on a Haiku call to
      // expand it into a proper creative brief before feeding the main
      // generation. This is the single biggest quality lever for
      // low-effort prompts ("сделай для стоматологии 990тг") that
      // otherwise produce generic, disappointing creatives. Falls
      // through to the original prompt on any error.
      const wordCount = (prompt || "").trim().split(/\s+/).filter(Boolean).length;
      const charCount = (prompt || "").trim().length;
      const hasRefs = Array.isArray(referenceImagesBase64) && referenceImagesBase64.length > 0;
      const hasProds = Array.isArray(productImagesBase64) && productImagesBase64.length > 0;
      const isThin = (charCount < 60 || wordCount < 8) && !hasRefs && !hasProds;

      let effectivePrompt = prompt;
      if (isThin && process.env.ANTHROPIC_API_KEY) {
        try {
          const enhanceRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": process.env.ANTHROPIC_API_KEY,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 600,
              system:
                "Ты эксперт-копирайтер казахстанского рекламного агентства. Юзеру лень писать ТЗ — он шлёт одну короткую фразу. Расширь её в полноценный бриф для рекламного креатива на 4-7 строк. Покрой: визуальный стиль и настроение, цветовая гамма (если уместно), главный заголовок (хук), подзаголовок-уточнение, призыв к действию (CTA). НИЧЕГО не выдумывай чего нет в брифе — никаких фейковых цен, дат, скидок, гарантий. Если юзер указал тариф «990 тг» — это ровно «990 тг», не перевирай. Отвечай ТОЛЬКО на русском, ТОЛЬКО самим текстом брифа, без вступлений и комментариев. Сохрани оригинальное намерение юзера.",
              messages: [
                {
                  role: "user",
                  content: `Краткое ТЗ юзера:\n\n"${prompt}"\n\nФормат итогового креатива: ${format}.`,
                },
              ],
            }),
            signal: AbortSignal.timeout(8000),
          });
          if (enhanceRes.ok) {
            const enhanceData = await enhanceRes.json();
            const expanded = enhanceData?.content?.[0]?.text?.trim();
            if (expanded && expanded.length > charCount) {
              effectivePrompt = `Оригинальное ТЗ юзера: "${prompt}"\n\nРасшифрованный бриф (используй его как основу, но не выдумывай деталей сверх него):\n${expanded}`;
              console.log(`[generate] enhanced thin prompt (${charCount}→${expanded.length} chars)`);
            }
          }
        } catch (e) {
          console.warn("[generate] prompt enhance failed, using original", e);
        }
      }

      // Inject niche-specific style guidance when the user picked a
       // niche from the editor dropdown. Goes into the user message
       // (not system) so it doesn't break system-prompt caching, and
       // so different users with different niche choices each get a
       // tailored default without us maintaining N system prompts.
       const nichePack = getNichePack(niche);
       if (nichePack.systemHint) {
         claudeContent.push({
           type: "text",
           text: `STYLE GUIDE (apply unless overridden by reference image): ${nichePack.systemHint}`,
         });
       }

       claudeContent.push({ type: "text", text: `Format required: ${format}.\n\nTask (ТЗ): ${effectivePrompt}` });
    }

    // Handle references
    if (referenceImagesBase64 && Array.isArray(referenceImagesBase64) && referenceImagesBase64.length > 0) {
      claudeContent.push({ type: "text", text: "Here are REFERENCE IMAGES for atmosphere, style, and layout. Recreate this vibe/quality:" });
      for (const imgUrl of referenceImagesBase64) {
        let mimeType = "image/jpeg";
        let data = imgUrl;
        if (data.startsWith("data:")) {
           mimeType = data.split(";")[0].split(":")[1];
           data = data.split(",")[1];
        }
        claudeContent.push({
          type: "image",
          source: { type: "base64", media_type: mimeType, data: data }
        });
      }
    }

    // Handle actual products
    if (productImagesBase64 && Array.isArray(productImagesBase64) && productImagesBase64.length > 0) {
      claudeContent.push({ type: "text", text: "Here are the actual PRODUCT IMAGES without backgrounds. You MUST use these exact images in the HTML creative as graphical assets:" });
      for (const imgUrl of productImagesBase64) {
        let mimeType = "image/png";
        let data = imgUrl;
        if (data.startsWith("data:")) {
           mimeType = data.split(";")[0].split(":")[1];
           data = data.split(",")[1];
        }
        claudeContent.push({
          type: "image",
          source: { type: "base64", media_type: mimeType, data: data }
        });
      }
    }

    let rawText = "";
    let apiCostKzt = 0;

    if (useGemini) {
      // ====== GEMINI 3.1 PRO PATH ======
      // Convert Anthropic-style claudeContent[] into Gemini parts[].
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) throw new Error("GEMINI_API_KEY is missing");

      const geminiParts: any[] = [];
      for (const item of claudeContent) {
        if (item.type === "text") {
          geminiParts.push({ text: item.text });
        } else if (item.type === "image" && item.source?.data) {
          geminiParts.push({
            inlineData: {
              mimeType: item.source.media_type,
              data: item.source.data,
            },
          });
        }
      }

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: geminiParts }],
            generationConfig: {
              maxOutputTokens: 8192,
              temperature: 0.7,
            },
          }),
        },
      );

      if (!geminiRes.ok) {
        const text = await geminiRes.text();
        throw new Error(`Gemini API error: ${text}`);
      }

      const geminiData = await geminiRes.json();
      rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // Gemini 3.1 Pro pricing (April 2026 public): $1.25/M input,
      // $5/M output. Same KZT rate as Claude path for consistency.
      const usage = geminiData?.usageMetadata;
      if (usage) {
        const inT = usage.promptTokenCount || 0;
        const outT = usage.candidatesTokenCount || 0;
        const usd = (inT / 1_000_000) * 1.25 + (outT / 1_000_000) * 5.0;
        apiCostKzt = usd * 480;
        console.log(`[API Cost] Gemini: ${inT} in, ${outT} out = $${usd.toFixed(4)} (~${apiCostKzt.toFixed(2)} KZT)`);
      }
    } else {
      // ====== CLAUDE OPUS 4.7 PATH (default) ======
      const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
      if (!anthropicApiKey) throw new Error("ANTHROPIC_API_KEY is missing");

      let claudeResponse: Response | null = null;
      let retries = 0;
      let errPayload = "";

      while (retries < 3) {
        claudeResponse = await fetch(`https://api.anthropic.com/v1/messages`, {
           method: "POST",
           headers: {
             "Content-Type": "application/json",
             "x-api-key": anthropicApiKey,
             "anthropic-version": "2023-06-01",
             "anthropic-beta": "extended-cache-ttl-2025-04-11",
           },
           body: JSON.stringify({
              model: "claude-opus-4-7",
              system: [
                {
                  type: "text",
                  text: systemPrompt,
                  cache_control: { type: "ephemeral", ttl: "1h" },
                },
              ],
              max_tokens: 8192,
              messages: [{ role: "user", content: claudeContent }]
           })
        });

        if (claudeResponse.status === 429) {
            retries++;
            console.warn(`[Claude Rate Limit] Hit TPM limit (429). Retrying ${retries}/3 in 15 seconds...`);
            await new Promise(r => setTimeout(r, 15000));
            continue;
        }

        if (!claudeResponse.ok) {
            errPayload = await claudeResponse.text();
            throw new Error(`Claude API error: ${errPayload}`);
        }

        break;
      }

      if (!claudeResponse || !claudeResponse.ok) {
          throw new Error(`Claude API error (max retries exceeded): ${errPayload}`);
      }

      const result = await claudeResponse.json();
      rawText = result.content?.[0]?.text || "";

      // Claude pricing comment is historical — Opus 4.7 is $15 input
      // / $75 output per 1M tokens. Cached input tokens are billed at
      // 10% of base rate, but the usage object below reports them
      // separately as cache_read_input_tokens; we treat them as
      // input here for an approximate cost.
      if (result.usage) {
         const inTokens = result.usage.input_tokens || 0;
         const outTokens = result.usage.output_tokens || 0;
         const usdCost = (inTokens / 1_000_000) * 15.0 + (outTokens / 1_000_000) * 75.0;
         apiCostKzt = usdCost * 480;
         console.log(`[API Cost] Claude Opus 4.7: ${inTokens} in, ${outTokens} out = $${usdCost.toFixed(4)} (~${apiCostKzt.toFixed(2)} KZT)`);
      }
    }

    // Clean up if the model magically returns markdown
    let code = rawText.trim();
    const match = code.match(/```(?:html)?\s*([\s\S]*?)```/);
    if (match) {
      code = match[1];
    }

    // Deterministic post-generation linter — purely observational for
    // now. Issues are logged so we can see how often each defect class
    // fires across the userbase; once we have telemetry over a week or
    // two we can decide whether the cost of an auto-retry on HIGH
    // issues is worth paying. No blocking, no extra Claude calls.
    try {
      const lintIssues = lintCreativeHtml(code);
      if (lintIssues.length > 0) {
        const high = lintIssues.filter((i) => i.severity === "high").length;
        const low = lintIssues.filter((i) => i.severity === "low").length;
        console.log(
          `[lint] ${lintIssues.length} issue(s) (${high} high, ${low} low):`,
          lintIssues.map((i) => i.code).join(", "),
        );
      }
    } catch (e) {
      // Linter must never break a generation — swallow.
      console.warn("[lint] linter crashed:", e);
    }

    // Replace placeholders with real Base64 data (From original generation)
    if (productImagesBase64 && Array.isArray(productImagesBase64)) {
      productImagesBase64.forEach((imgBase64: string, index: number) => {
        const searchPattern = new RegExp(`PRODUCT_IMG_${index}`, 'g');
        code = code.replace(searchPattern, imgBase64);
      });
    }

    // Re-inject preserved base64 images from Remix context
    if (preservedImages && preservedImages.length > 0) {
      preservedImages.forEach((imgBase64: string, index: number) => {
        const searchPattern = new RegExp(`REMIX_PRESERVED_IMG_${index}`, 'g');
        code = code.replace(searchPattern, imgBase64);
      });
    }

    // Balance was deducted up-front; now just record the creative.
    // If this INSERT itself throws, the outer catch refunds the user.
    const creativeId = crypto.randomUUID();
    await db.insert(creatives).values({
      id: creativeId,
      userId,
      prompt: prompt,
      format,
      cost: cost,
      apiCostKzt: apiCostKzt,
      htmlCode: code,
    });

    // Success — do NOT refund.
    deductedCost = 0;

    return new Response(
      JSON.stringify({ code, creativeId }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    // If we already deducted impulses but failed before returning success,
    // refund them. Claude API cost is sunk on our side, but the USER should
    // not lose balance for a failed generation.
    if (deductedCost > 0 && deductedUserId) {
      try {
        await db.update(users)
          .set({ impulses: sql`${users.impulses} + ${deductedCost}` })
          .where(eq(users.id, deductedUserId));
        console.warn(`[Refund] Returned ${deductedCost} impulses to ${deductedUserId} after generation failure.`);
      } catch (refundErr) {
        // If the refund itself fails, log loudly — this needs manual fix.
        console.error('[Refund FAILED]', { userId: deductedUserId, cost: deductedCost, refundErr });
      }
    }
    console.error('Claude API Error:', error);
    return Response.json({ error: error.message || 'Error generating content via Claude' }, { status: 500 });
  }
}
