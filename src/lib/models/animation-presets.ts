/**
 * Animation presets for image-to-video.
 *
 * Hardcoded English prompts mapped to Russian preset labels. The user
 * never sees or writes the underlying prompt — they pick a preset by
 * label, and the backend looks up the prompt at submit time.
 *
 * IMPORTANT design rule (added 2026-04-30): every preset locks the
 * camera and the product in place. The original frame must remain
 * IDENTICAL throughout the clip — only ambient motion within the
 * existing composition (light, particles, atmosphere, glow) is allowed.
 * No camera dolly, no zoom, no product rotation, no re-framing.
 *
 * This is what advertisers want for a 5-second loop: the static
 * creative they picked, gently brought to life. Anything that moves
 * the camera makes it feel like a different shot, not the same poster.
 */

export type AnimationPresetId =
  | "subtle"
  | "lights"
  | "atmosphere"
  | "energy"
  | "reveal"
  // Action presets — used by the "Промо со звуком" flow. Frame is NOT
  // locked: the product/person performs a small action. Pairs with
  // MMAudio for synchronized sound effects.
  | "unbox"
  | "smile"
  | "interact"
  | "ambience";

export interface AnimationPreset {
  id: AnimationPresetId;
  /** Russian label shown in the editor UI. */
  label: string;
  /** Short description shown under the chip on hover/long-press. */
  description: string;
  /** English prompt sent to fal.ai. */
  prompt: string;
  /**
   * "ambient" — frame-locked, only ambient motion (light, atmosphere).
   * "action" — product/person performs a small action; pairs with sound.
   */
  category: "ambient" | "action";
}

const FRAME_LOCK = `STRICT REQUIREMENTS — these override everything:
- The camera is COMPLETELY STATIC. No dolly, no pan, no zoom, no tilt, no shake.
- The product, all text, all logos, and all composition elements stay in EXACTLY the same position from frame 1 to last frame.
- The frame's overall composition is IDENTICAL to the source image — treat it as a still poster being gently brought to life.
- All animation must happen WITHIN the existing scene (light, atmosphere, sparkle, glow), never by moving the camera or repositioning subjects.
- Do NOT redraw, redesign, or re-render the product or text. Preserve every pixel of identity.`;

export const ANIMATION_PRESETS: AnimationPreset[] = [
  {
    id: "subtle",
    category: "ambient",
    label: "Лёгкое оживление",
    description: "Едва заметное движение света. Кадр и продукт неподвижны.",
    prompt:
      `${FRAME_LOCK}\n\n` +
      `Add a barely-perceptible ambient layer: extremely subtle light shimmer ` +
      `across smooth surfaces, gentle highlights drifting on edges, soft tonal ` +
      `breathing (lighting intensity ±2%). Nothing else moves. The scene feels alive ` +
      `but the frame is locked, like a high-end poster with a kiss of motion.`,
  },
  {
    id: "lights",
    category: "ambient",
    label: "Световые блики",
    description: "Тёплые блики и отражения. Композиция стабильна.",
    prompt:
      `${FRAME_LOCK}\n\n` +
      `Add cinematic lighting effects layered onto the frozen scene: warm light ` +
      `rays drifting slowly across the product surface, soft lens flares appearing ` +
      `briefly and fading, subtle reflection highlights catching curves. Lighting ` +
      `must look like real studio practicals, not motion graphics. Camera stays still.`,
  },
  {
    id: "atmosphere",
    category: "ambient",
    label: "Атмосфера / пар",
    description: "Лёгкий пар, пыль или искры в воздухе. Кадр зафиксирован.",
    prompt:
      `${FRAME_LOCK}\n\n` +
      `Layer in atmospheric ambient elements behind and around the product: ` +
      `slow-drifting fine particles (dust motes, soft sparkles, or steam wisps), ` +
      `volumetric haze breathing softly, tiny light specks floating up. These ` +
      `elements appear in negative space, never crossing or obscuring the product ` +
      `or text. The scene gains depth and life while the framing stays absolute.`,
  },
  {
    id: "energy",
    category: "ambient",
    label: "Энергия / свечение",
    description: "Пульсирующее свечение, лёгкие искры. Без сдвига кадра.",
    prompt:
      `${FRAME_LOCK}\n\n` +
      `Add a controlled energy layer: a soft glow pulse around the product (rhythm ` +
      `~1 cycle per 2 seconds, intensity ±15%), occasional tiny accent sparks ` +
      `or light flicks at edges, a barely-there color temperature shift in the ` +
      `background gradient. The product itself does not move or transform — only ` +
      `the energy field around it animates. The camera is bolted down.`,
  },
  {
    id: "reveal",
    category: "ambient",
    label: "Раскрытие продукта",
    description: "Продукт открывается / распаковывается. Камера статична.",
    // NOTE: This preset INTENTIONALLY breaks the FRAME_LOCK rule for
    // the product itself — it's the one preset where transformation IS
    // the point (case opens, lid lifts, packaging unfolds). Camera and
    // background stay locked; only the product mechanically reveals.
    prompt:
      `STRICT REQUIREMENTS — these override everything:\n` +
      `- The camera is COMPLETELY STATIC. No dolly, no pan, no zoom, no tilt, no shake.\n` +
      `- All text, logos, and background elements stay in EXACTLY the same position throughout.\n` +
      `- The product itself MAY animate ONLY in the way it naturally opens or unfolds — ` +
      `lid lifting, case opening, packaging unfurling, contents emerging from inside.\n` +
      `- The motion is mechanical and physically plausible (real hinges, real materials), ` +
      `not magical morphing. Smooth easing, no abrupt teleports.\n` +
      `- Pacing for a 5-second clip: t=0-1s closed/idle, t=1-3s opening motion, t=3-5s held open with subtle settling.\n` +
      `- For a 10-second clip: t=0-2s closed/idle, t=2-5s opening, t=5-10s held open with the contents catching ambient light.\n` +
      `- Do NOT redraw, redesign, or re-render the product itself. Preserve every detail of identity ` +
      `(brand, color, materials, proportions). The opened state should look like the same product, just opened.`,
  },
  // ─── ACTION PRESETS — used by "Промо со звуком" ──────────────────
  // Frame-lock is partially relaxed here: the product or person performs
  // a brief, recognizable action. The camera still does NOT move (no
  // dolly/pan/zoom) — only the subject inside the frame moves. Output
  // is always 5 sec; client auto-chains MMAudio for sound effects that
  // sync with the visible action.
  {
    id: "unbox",
    category: "action",
    label: "Открытие / распаковка",
    description: "Коробка/чехол щёлкает и открывается. Идеально для наушников, гаджетов, парфюма.",
    prompt:
      `STRICT REQUIREMENTS — these override everything:\n` +
      `- The camera is COMPLETELY STATIC. No dolly, no pan, no zoom, no tilt.\n` +
      `- All text, logos, and the BACKGROUND stay in EXACTLY the same position throughout.\n` +
      `- The product is the only thing that animates. It mechanically opens, unboxes, ` +
      `or reveals its contents — lid flips up, case clicks open, package unfolds, ` +
      `headphones case lid pops up exposing the buds, perfume cap lifts off.\n` +
      `- The motion is physically plausible: real hinges, real materials, real weight. ` +
      `Smooth easing, no warping or magical morphing.\n` +
      `- 5-second pacing: t=0-1s closed and still, t=1-2s a slight nudge or pre-motion, ` +
      `t=2-3.5s the actual open/click action, t=3.5-5s held open with contents catching light.\n` +
      `- Preserve every detail of brand, color, materials, proportions. The opened state ` +
      `must look like the same product just in its open configuration.`,
  },
  {
    id: "smile",
    category: "action",
    label: "Улыбка / эмоция",
    description: "Человек улыбается, моргает, чуть поворачивает голову. Для портретов и lifestyle.",
    prompt:
      `STRICT REQUIREMENTS — these override everything:\n` +
      `- The camera is COMPLETELY STATIC. No dolly, no pan, no zoom, no tilt, no shake.\n` +
      `- The framing, background, lighting, and clothing all stay in the same position.\n` +
      `- The PERSON in the frame may animate naturally and warmly: a soft smile blooming, ` +
      `eyes blinking, head tilting just slightly, hair settling. Lifelike micro-expressions only.\n` +
      `- The person's identity, face structure, skin tone, and outfit must NOT change. ` +
      `This is the same person from the source image, gently brought to life.\n` +
      `- 5-second pacing: t=0-1s neutral expression, t=1-3s warmth builds (smile forms, ` +
      `eyes soften), t=3-5s held smile with one natural blink.\n` +
      `- The mood is genuine, magazine-quality, never uncanny or exaggerated. No lip-sync, ` +
      `no talking, no teeth-gnashing — just human warmth.\n` +
      `- Background elements may have very subtle ambient motion (light, hair).`,
  },
  {
    id: "interact",
    category: "action",
    label: "Взаимодействие с товаром",
    description: "Рука берёт, надевает, демонстрирует продукт. Для одежды, аксессуаров, гаджетов.",
    prompt:
      `STRICT REQUIREMENTS — these override everything:\n` +
      `- The camera is COMPLETELY STATIC. No dolly, no pan, no zoom, no tilt.\n` +
      `- The background and overall framing stay locked.\n` +
      `- A natural human interaction with the product happens within the frame: a hand ` +
      `enters and picks up the item, slides it on, opens it, demonstrates a feature. ` +
      `If the source already has a person holding the product, they perform a small ` +
      `presentation gesture (turning the item, showing a detail, putting it on).\n` +
      `- The product's identity and design are preserved exactly. Hands and skin look natural.\n` +
      `- 5-second pacing: t=0-1s setup pose, t=1-3.5s the interaction motion (clean and ` +
      `purposeful), t=3.5-5s held final pose where the product is showcased.\n` +
      `- No face redesigning, no lip motion, no magical morphs. Real human movement quality.`,
  },
  {
    id: "ambience",
    category: "action",
    label: "Действие на фоне",
    description: "Что-то происходит на фоне (волны, ветер, машины едут). Продукт остаётся в центре.",
    prompt:
      `STRICT REQUIREMENTS — these override everything:\n` +
      `- The camera is COMPLETELY STATIC. No dolly, no pan, no zoom, no tilt.\n` +
      `- The product, all text, and all logos in the foreground are FROZEN in place. ` +
      `They don't move at all. The product looks like a still cutout.\n` +
      `- The BACKGROUND comes to life with one clear ambient action that matches the ` +
      `scene: ocean waves rolling, tree leaves swaying in wind, cars driving past in ` +
      `the distance, steam rising from a coffee cup behind the product, fabric blowing, ` +
      `clouds drifting, water rippling. Pick the action that fits what's already in the source.\n` +
      `- Background motion is continuous and natural for the full 5 seconds, not a one-shot event.\n` +
      `- The contrast is stark: foreground product is a perfectly still hero, background is alive.\n` +
      `- Preserve product identity exactly. No artifacts touching the product.`,
  },
];

export function getAnimationPreset(id: string | undefined | null): AnimationPreset {
  const found = ANIMATION_PRESETS.find((p) => p.id === id);
  return found ?? ANIMATION_PRESETS[0];
}

export const AMBIENT_PRESETS = ANIMATION_PRESETS.filter((p) => p.category === "ambient");
export const ACTION_PRESETS = ANIMATION_PRESETS.filter((p) => p.category === "action");
