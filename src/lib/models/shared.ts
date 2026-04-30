/** Aspect-ratio formats supported by the editor + image-gen models.
 *  Gemini 3 Pro Image supports all 5 natively. GPT Image 2 only has
 *  three pixel sizes — we map to the closest one (see gpt-image.ts). */
export type Format = "9:16" | "3:4" | "1:1" | "4:3" | "16:9";
