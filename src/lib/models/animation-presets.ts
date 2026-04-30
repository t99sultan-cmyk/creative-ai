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
  | "reveal";

export interface AnimationPreset {
  id: AnimationPresetId;
  /** Russian label shown in the editor UI. */
  label: string;
  /** Short description shown under the chip on hover/long-press. */
  description: string;
  /** English prompt sent to fal.ai. */
  prompt: string;
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
];

export function getAnimationPreset(id: string | undefined | null): AnimationPreset {
  const found = ANIMATION_PRESETS.find((p) => p.id === id);
  return found ?? ANIMATION_PRESETS[0];
}
