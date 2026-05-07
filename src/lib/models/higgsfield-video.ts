/**
 * Higgsfield API helpers — image-to-video generation via the queue.
 *
 * Auth scheme: `Authorization: Key {api_key}:{api_secret}` (custom format,
 * NOT bearer). Both pieces come from .env.local — temporary keys for
 * the integration test phase, will be rotated once the flow is approved.
 *
 * ⚠️ SECURITY — KEY ROTATION REQUIRED:
 * The Higgsfield API_KEY + API_SECRET were exposed in chat conversation
 * during initial integration setup. They MUST be rotated before
 * production launch:
 *   1. Generate new credentials in Higgsfield dashboard
 *   2. Update HIGGSFIELD_API_KEY + HIGGSFIELD_API_SECRET on Vercel
 *      (Settings → Environment Variables → Production)
 *   3. Update .env.local for local dev
 *   4. Old keys auto-revoke after rotation in Higgsfield UI
 *
 * Until rotated, treat these as compromised — anyone with chat history
 * access can call Higgsfield on our account budget.
 *
 * Async/queue pattern (mirrors fal.ai):
 *   submit() → returns request_id immediately
 *   check()  → polls /requests/{id}/status until completed/failed
 *
 * Status values in their docs: queued | in_progress | nsfw | failed | completed.
 *
 * Cost is not yet wired into impulses — for the local test phase we just
 * exercise the API. Pricing decision is deferred until the user picks a
 * model variant they like (DoP standard vs Kling 2.1 Pro vs Seedance Pro).
 */

const HIGGSFIELD_BASE = "https://platform.higgsfield.ai";

export type HiggsfieldModelId =
  // Higgsfield's own DoP (Director of Photography) model — cinematic
  // motion presets, the flagship that makes Higgsfield distinctive vs
  // raw image-to-video. Use this as the default for "Таргет-ролик".
  | "higgsfield-ai/dop/standard"
  | "higgsfield-ai/dop/preview"
  // Aggregated 3rd-party models offered through the Higgsfield gateway.
  // Same auth, same queue pattern — just a different model_id path.
  | "kling-video/v2.1/pro/image-to-video"
  | "bytedance/seedance/v1/pro/image-to-video";

export interface HiggsfieldSubmitInput {
  /**
   * Public HTTP(S) URL of the source image. Higgsfield does NOT accept
   * data: URIs — pass the GCS/Cloudinary URL stored in `creative.imageUrl`.
   */
  imageUrl: string;
  /** Motion description. English — Higgsfield expects English prompts. */
  prompt: string;
  /** Output duration in seconds. Most models accept 5 (default) or 10. */
  duration?: 5 | 10;
  /**
   * Aspect ratio (e.g. "16:9", "9:16", "1:1"). Optional — model picks a
   * sensible default when omitted, usually matching the input image.
   */
  aspectRatio?: "16:9" | "9:16" | "1:1";
  /** Output resolution. "720p" is the most common cap on standard tier. */
  resolution?: "720p" | "1080p";
}

export type HiggsfieldStatus =
  | { state: "queued" | "in_progress" }
  | { state: "completed"; videoUrl: string }
  | { state: "failed"; error: string };

function authHeader(): { Authorization: string } {
  const key = process.env.HIGGSFIELD_API_KEY;
  const secret = process.env.HIGGSFIELD_API_SECRET;
  if (!key || !secret) {
    throw new Error("HIGGSFIELD_API_KEY / HIGGSFIELD_API_SECRET missing in env");
  }
  return { Authorization: `Key ${key}:${secret}` };
}

/**
 * Submit an image-to-video request. Returns the queue request_id.
 * Throws on transport / auth error so the route handler can refund
 * impulses cleanly.
 */
export async function submitHiggsfieldVideo(
  input: HiggsfieldSubmitInput,
  opts: { model?: HiggsfieldModelId } = {},
): Promise<string> {
  const model: HiggsfieldModelId = opts.model ?? "higgsfield-ai/dop/standard";

  const body: Record<string, unknown> = {
    image_url: input.imageUrl,
    prompt: input.prompt,
  };
  if (input.duration) body.duration = input.duration;
  if (input.aspectRatio) body.aspect_ratio = input.aspectRatio;
  if (input.resolution) body.resolution = input.resolution;

  const res = await fetch(`${HIGGSFIELD_BASE}/${model}`, {
    method: "POST",
    headers: { ...authHeader(), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Higgsfield submit (${res.status}): ${text.slice(0, 400)}`);
  }
  const data = await res.json();
  const requestId = data?.request_id;
  if (typeof requestId !== "string") {
    throw new Error(
      `Higgsfield returned no request_id. Raw: ${JSON.stringify(data).slice(0, 300)}`,
    );
  }
  return requestId;
}

/** Poll the queue for the current state of a request. */
export async function checkHiggsfieldVideo(requestId: string): Promise<HiggsfieldStatus> {
  const res = await fetch(`${HIGGSFIELD_BASE}/requests/${requestId}/status`, {
    headers: authHeader(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      state: "failed",
      error: `status (${res.status}): ${text.slice(0, 300)}`,
    };
  }
  const data = await res.json();
  const status = String(data?.status || "").toLowerCase();
  if (status === "queued") return { state: "queued" };
  if (status === "in_progress") return { state: "in_progress" };
  if (status === "failed") {
    return {
      state: "failed",
      error: String(data?.error || "Higgsfield failed without details"),
    };
  }
  if (status === "nsfw") {
    return {
      state: "failed",
      error: "Контент не прошёл модерацию (nsfw). Кредиты возвращены.",
    };
  }
  if (status === "completed") {
    const videoUrl = data?.video?.url;
    if (typeof videoUrl !== "string") {
      return {
        state: "failed",
        error: `no video.url in completed response: ${JSON.stringify(data).slice(0, 300)}`,
      };
    }
    return { state: "completed", videoUrl };
  }
  // Unknown status — treat as still-running rather than fail.
  return { state: "in_progress" };
}
