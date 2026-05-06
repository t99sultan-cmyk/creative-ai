/**
 * Higgsfield motion presets — used by the "🎯 Таргет-ролик" mode.
 *
 * Higgsfield's DoP (Director of Photography) model thrives on cinematic
 * camera work — dolly, push, orbit, crane. These presets pick well-tested
 * shot types that read as "professional ad" in 5-10 seconds and don't
 * fight the static creative's text/logos.
 *
 * Distinct from the Seedance presets in animation-presets.ts:
 *   - Seedance ambient → camera locked, only light/atmosphere moves
 *   - Seedance action  → product/person performs a small action, locked frame
 *   - Higgsfield       → CAMERA MOVES cinematically, frame evolves
 *
 * Russian labels for the editor UI; English prompts go to the API.
 */

export type HiggsfieldPresetId =
  | "cinematic"
  | "push-in"
  | "orbit"
  | "reveal"
  | "parallax";

export interface HiggsfieldPreset {
  id: HiggsfieldPresetId;
  /** Russian label shown in the editor. */
  label: string;
  /** Short description shown under the chip. */
  description: string;
  /** English motion prompt sent to Higgsfield. */
  prompt: string;
}

export const HIGGSFIELD_PRESETS: HiggsfieldPreset[] = [
  {
    id: "cinematic",
    label: "Кинематографично",
    description: "Плавное движение камеры, мягкий свет — премиум-вибес.",
    prompt:
      `Cinematic shot, professional advertising aesthetic. Slow elegant camera movement — ` +
      `a gentle drift forward combined with a barely-perceptible vertical lift. Soft cinematic ` +
      `lighting, golden-hour warmth, shallow depth of field with the product tack-sharp. The ` +
      `composition stays balanced throughout — text and logos remain readable, product remains ` +
      `the hero. The whole clip feels like a high-end fragrance or watch commercial: confident, ` +
      `unhurried, premium. No abrupt motions, no zoom punches, no shake.`,
  },
  {
    id: "push-in",
    label: "Push-in (наезд)",
    description: "Камера медленно наезжает на товар. Идеально для гаджетов, парфюма.",
    prompt:
      `Slow cinematic push-in toward the hero subject. Camera dollies forward smoothly over ` +
      `the full clip duration — start framing wider, end with the product filling more of the ` +
      `frame. No zoom (use real dolly motion). Ambient light stays consistent with subtle ` +
      `intensification as we approach. Background gently blurs as we get closer — natural ` +
      `depth-of-field shift, no artificial vignette. Product details become more visible: ` +
      `material texture, brand logo, surface highlights. Stop just before the product crops.`,
  },
  {
    id: "orbit",
    label: "Орбитальный облёт",
    description: "Камера обходит товар вокруг. Для часов, ювелирки, обуви, гаджетов.",
    prompt:
      `Slow orbital camera move, ~30 degrees of arc around the hero subject over the full clip. ` +
      `The product stays centered in frame; the camera circles it from a slight high angle. ` +
      `Light direction shifts naturally as we orbit, revealing different facets — material grain, ` +
      `bevels, reflections. Background environment rotates in parallax behind the product. ` +
      `Smooth easing in and out. Premium product showcase aesthetic, like a luxury watch or ` +
      `sneaker reveal video.`,
  },
  {
    id: "reveal",
    label: "Раскрытие",
    description: "Камера поднимается, открывая полный кадр. Для драматичных промо.",
    prompt:
      `Cinematic reveal: camera starts low and tight on a key detail (texture, packaging detail, ` +
      `or surface), then smoothly rises and pulls back to show the full hero composition with the ` +
      `product, headline, and overall scene. Crane-like motion, smooth easing. Lighting ` +
      `intensifies as the full scene reveals — like a stage light coming up. End on the wide ` +
      `composition with everything readable. Premium fragrance / luxury car commercial vibe.`,
  },
  {
    id: "parallax",
    label: "Параллакс-сцена",
    description: "Лёгкое 3D-движение фона, товар стабилен. Для социалок (Reels/TikTok).",
    prompt:
      `Subtle 3D parallax effect across the static composition. The hero subject and any ` +
      `foreground text/logos drift slightly faster than the background, creating a perceived ` +
      `depth shift — feels like the camera is tracking sideways through a layered scene. Very ` +
      `subtle, never disorienting. Background atmosphere (light, particles, soft elements) ` +
      `breathes gently. Modern social-media-ad aesthetic — works perfectly for vertical 9:16 ` +
      `Reels and TikTok feed creatives. No abrupt motion.`,
  },
];

export function getHiggsfieldPreset(
  id: HiggsfieldPresetId | string | null | undefined,
): HiggsfieldPreset {
  const found = HIGGSFIELD_PRESETS.find((p) => p.id === id);
  return found ?? HIGGSFIELD_PRESETS[0];
}
