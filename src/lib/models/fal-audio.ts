/**
 * fal.ai MMAudio v2 — video-to-audio generation.
 *
 * Takes an MP4 URL, watches the visual content, generates a contextual
 * sound layer (footsteps, ambience, splash, wind, etc.) and returns a
 * new MP4 URL with the audio track merged in.
 *
 * ~$0.05 per clip on fal.ai. Total render time ~20-60 sec. We poll the
 * status synchronously inside the Next.js route — well within Vercel's
 * 5-minute timeout.
 *
 * Uses the same queue API + namespace-based status URL pattern that
 * fal-video.ts uses (see comment there for why).
 */

const FAL_MODEL = "fal-ai/mmaudio-v2";
const FAL_QUEUE_BASE = "https://queue.fal.run";

function falNamespace(modelPath: string): string {
  const parts = modelPath.split("/");
  return parts.slice(0, 2).join("/");
}

function authHeader(): { Authorization: string } {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) throw new Error("FAL_KEY is missing");
  return { Authorization: `Key ${apiKey}` };
}

export interface FalAudioInput {
  /** Public MP4 URL to add audio to. */
  videoUrl: string;
  /** Optional descriptive prompt (e.g. "energetic ad music with subtle whoosh"). */
  prompt?: string;
  /** How many seconds of audio to generate (defaults to 5). */
  durationSec?: number;
}

export interface FalAudioResult {
  /** Final MP4 URL — original video with audio mixed in. */
  videoUrl: string;
}

/**
 * Synchronous wrapper: submits, polls every 3 sec, returns when done.
 * Throws on failure or timeout (default 4 minutes).
 */
export async function callFalAudio(
  input: FalAudioInput,
  opts: { maxWaitMs?: number } = {},
): Promise<FalAudioResult> {
  const maxWaitMs = opts.maxWaitMs ?? 4 * 60_000;

  const submitBody: Record<string, unknown> = {
    video_url: input.videoUrl,
    prompt: input.prompt || "Cinematic advertising soundscape, subtle whoosh and ambient layer matching the visuals.",
    num_steps: 25,
  };
  if (typeof input.durationSec === "number") {
    submitBody.duration = input.durationSec;
  }

  // Submit to the queue.
  const submitRes = await fetch(`${FAL_QUEUE_BASE}/${FAL_MODEL}`, {
    method: "POST",
    headers: { ...authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify(submitBody),
    signal: AbortSignal.timeout(30_000),
  });
  if (!submitRes.ok) {
    const text = await submitRes.text().catch(() => "");
    throw new Error(`MMAudio submit failed (${submitRes.status}): ${text.slice(0, 400)}`);
  }
  const submitData = await submitRes.json();
  const requestId = submitData?.request_id;
  if (typeof requestId !== "string") {
    throw new Error(`MMAudio: no request_id. Raw: ${JSON.stringify(submitData).slice(0, 300)}`);
  }

  // Poll status.
  const ns = falNamespace(FAL_MODEL);
  const startedAt = Date.now();
  while (Date.now() - startedAt < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 3000));
    const statusRes = await fetch(
      `${FAL_QUEUE_BASE}/${ns}/requests/${requestId}/status`,
      { headers: authHeader(), signal: AbortSignal.timeout(15_000) },
    );
    if (!statusRes.ok) {
      const t = await statusRes.text().catch(() => "");
      throw new Error(`MMAudio status (${statusRes.status}): ${t.slice(0, 200)}`);
    }
    const status = await statusRes.json();
    const s = String(status?.status || "").toUpperCase();
    if (s === "FAILED") {
      throw new Error(`MMAudio failed: ${JSON.stringify(status).slice(0, 300)}`);
    }
    if (s === "COMPLETED") break;
    // IN_QUEUE / IN_PROGRESS — keep polling.
  }
  if (Date.now() - startedAt >= maxWaitMs) {
    throw new Error(`MMAudio timed out after ${Math.round(maxWaitMs / 1000)}s`);
  }

  // Fetch result.
  const resultRes = await fetch(
    `${FAL_QUEUE_BASE}/${ns}/requests/${requestId}`,
    { headers: authHeader(), signal: AbortSignal.timeout(15_000) },
  );
  if (!resultRes.ok) {
    const t = await resultRes.text().catch(() => "");
    throw new Error(`MMAudio result (${resultRes.status}): ${t.slice(0, 300)}`);
  }
  const result = await resultRes.json();

  // MMAudio v2 returns { video: { url: ... } } — the original video
  // with the generated audio mixed in. Some legacy variants also expose
  // an `audio.url` field, but for our use case we always want the
  // merged video.
  const videoUrl =
    result?.video?.url ||
    result?.output?.video?.url ||
    result?.video_url ||
    null;
  if (typeof videoUrl !== "string") {
    throw new Error(
      `MMAudio: no video URL in result. Raw: ${JSON.stringify(result).slice(0, 400)}`,
    );
  }
  return { videoUrl };
}
