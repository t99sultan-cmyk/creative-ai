/**
 * fal.ai image-to-video via the queue API.
 *
 * Active model: Seedance v1 Pro (ByteDance) image-to-video. Verified
 * via fal.ai API probe — Seedance 2.0 is not yet on fal.ai, only v1
 * (Pro and Lite). Pro picked over Lite for product-advertising quality.
 * ~$0.40-0.60 per 5-second clip at 1080p.
 *
 * Two-phase: submit() → returns request_id immediately, then status()
 * is polled until { status: "COMPLETED", video_url: ... } is returned.
 * Don't block the API route on completion — the user's editor polls
 * /api/animate/status from the browser.
 *
 * Image input: fal.ai accepts data: URIs directly for small images.
 * Our generated PNGs at 1024×1024 fit well under the inline-payload
 * limit. If we ever switch to larger sources we'll route through
 * fal.storage upload first.
 */

const FAL_MODEL = "fal-ai/bytedance/seedance/v1/pro/image-to-video";
const FAL_QUEUE_BASE = "https://queue.fal.run";

/**
 * fal.ai's queue uses the model's NAMESPACE (first 2 path segments) for
 * /requests endpoints, not the full model path. Submission goes to the
 * full path; status/result polling goes to the namespace.
 *
 * Example: model `fal-ai/bytedance/seedance/v2/fast/image-to-video`
 *   submit  → POST /fal-ai/bytedance/seedance/v2/fast/image-to-video
 *   status  → GET  /fal-ai/bytedance/requests/{id}/status
 *   result  → GET  /fal-ai/bytedance/requests/{id}
 *
 * For shorter model paths like `fal-ai/kling-video/v2.5/pro/image-to-video`
 * the namespace is `fal-ai/kling-video`. Same rule, just fewer segments.
 */
function falNamespace(modelPath: string): string {
  const parts = modelPath.split("/");
  return parts.slice(0, 2).join("/");
}

export type FalVideoStatus =
  | { state: "queued" | "in_progress" }
  | { state: "completed"; videoUrl: string }
  | { state: "failed"; error: string };

export interface FalSubmitInput {
  /** data: URL or http(s) URL of the source image. */
  imageUrl: string;
  /** Animation prompt (what should move / how the scene evolves). */
  prompt: string;
  /** Output duration in seconds. Seedance v1 Pro supports 5 or 10.
   *  Defaults to 5 (cheapest, fastest). */
  duration?: 5 | 10;
}

function authHeader(): { Authorization: string } {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) throw new Error("FAL_KEY is missing");
  return { Authorization: `Key ${apiKey}` };
}

/** Submit an image-to-video request. Returns the queue request_id. */
export async function submitFalVideo(input: FalSubmitInput): Promise<string> {
  const body = {
    image_url: input.imageUrl,
    prompt: input.prompt,
    duration: String(input.duration ?? 5),
  };

  const res = await fetch(`${FAL_QUEUE_BASE}/${FAL_MODEL}`, {
    method: "POST",
    headers: { ...authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fal submit failed (${res.status}): ${text.slice(0, 400)}`);
  }
  const data = await res.json();
  const requestId = data?.request_id;
  if (typeof requestId !== "string") {
    throw new Error(
      `fal submit returned no request_id. Raw: ${JSON.stringify(data).slice(0, 300)}`,
    );
  }
  return requestId;
}

/** Check status of a submitted request. */
export async function checkFalVideo(requestId: string): Promise<FalVideoStatus> {
  const ns = falNamespace(FAL_MODEL);
  const statusRes = await fetch(
    `${FAL_QUEUE_BASE}/${ns}/requests/${requestId}/status`,
    {
      headers: authHeader(),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!statusRes.ok) {
    const text = await statusRes.text().catch(() => "");
    return {
      state: "failed",
      error: `status (${statusRes.status}): ${text.slice(0, 300)}`,
    };
  }
  const status = await statusRes.json();
  // fal queue states: IN_QUEUE, IN_PROGRESS, COMPLETED, FAILED.
  const s = String(status?.status || "").toUpperCase();
  if (s === "IN_QUEUE") return { state: "queued" };
  if (s === "IN_PROGRESS") return { state: "in_progress" };
  if (s === "FAILED") {
    return {
      state: "failed",
      error: String(status?.error || JSON.stringify(status).slice(0, 300)),
    };
  }
  if (s !== "COMPLETED") {
    return { state: "in_progress" };
  }

  // COMPLETED → fetch the actual result for video URL.
  const resultRes = await fetch(
    `${FAL_QUEUE_BASE}/${ns}/requests/${requestId}`,
    {
      headers: authHeader(),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!resultRes.ok) {
    return {
      state: "failed",
      error: `result fetch failed (${resultRes.status})`,
    };
  }
  const result = await resultRes.json();
  const videoUrl = result?.video?.url || result?.output?.video?.url;
  if (typeof videoUrl !== "string") {
    return {
      state: "failed",
      error: `no video.url in result: ${JSON.stringify(result).slice(0, 300)}`,
    };
  }
  return { state: "completed", videoUrl };
}
