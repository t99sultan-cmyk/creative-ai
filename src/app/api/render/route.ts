import { NextResponse } from 'next/server';
import { db } from '@/db';
import { creatives } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@clerk/nextjs/server';

// Ensure this API route is dynamic and never cached
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CLOUD_RUN_URL =
  process.env.CLOUD_RUN_RENDER_URL ||
  'https://creative-cloud-renderer-694906438875.europe-west4.run.app/gcp/render/task';

// HTML from Gemini embeds product images as base64 data URIs. With 4 product
// images at ~1-2 MB each after background removal + WebP optimization, the
// full HTML blob can reach 5-8 MB. 10 MB gives comfortable headroom without
// inviting abuse. Cloud Run's own max request size is 32 MB, so we stay well
// under that too.
const MAX_HTML_LEN = 10_000_000; // 10 MB

/**
 * POST request to Cloud Run with a single long-tolerant attempt.
 *
 * We don't wait for render completion here — just for the "accepted"
 * handshake. Three important subtleties:
 *
 * 1. Cold start + 5 MB HTML upload can legitimately take 30-40 s. We
 *    allow 45 s instead of the old 12 s before aborting. If we abort
 *    early, Cloud Run may STILL be processing the payload on the other
 *    side — we just don't have an ACK to prove it.
 *
 * 2. On timeout we return `unknown: true` rather than a hard failure.
 *    The DB row stays in the `rendering:<ts>` state and the client's
 *    poller will pick up the finished video via /api/check-render →
 *    GCS HEAD or webhook. A 10-min safety cutoff there catches truly
 *    dead renders.
 *
 * 3. Retrying the ACK with a 5 MB body is expensive and can double-book
 *    Cloud Run. We DO retry on 429 (one time) because that one bounces
 *    fast without spending quota. We DON'T retry on timeouts — the
 *    first one is already processing.
 *
 * Returns classification:
 *   - ok:true                → Cloud Run acked, render proceeding
 *   - ok:false, unknown:true → timeout before ACK, render MAY still complete
 *   - ok:false, rateLimited  → 429, still throttled on retry
 *   - ok:false, clientError  → 4xx (bad html etc), won't work on retry
 */
async function postWithRetry(
  body: any,
): Promise<{
  ok: boolean;
  error?: string;
  status?: number;
  rateLimited?: boolean;
  unknown?: boolean;
}> {
  const attemptOnce = async (timeoutMs: number): Promise<{
    kind: 'ok' | 'timeout' | 'http';
    status?: number;
    text?: string;
  }> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(CLOUD_RUN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) return { kind: 'ok', status: res.status };
      const text = await res.text().catch(() => '');
      return { kind: 'http', status: res.status, text };
    } catch {
      clearTimeout(timer);
      return { kind: 'timeout' };
    }
  };

  // First attempt: long window (45 s) to cover cold start + 5 MB upload.
  const first = await attemptOnce(45_000);

  if (first.kind === 'ok') return { ok: true, status: first.status };

  if (first.kind === 'timeout') {
    // Cloud Run didn't ACK, but it likely GOT the payload and is grinding.
    // Return `unknown:true` so the handler keeps the DB row in `rendering`
    // state instead of marking as failed. The poller will catch success.
    console.warn('[Cloud Run] ACK timeout after 45s — proceeding as "likely rendering"');
    return { ok: false, unknown: true, error: 'Cloud Run ACK timeout (render may still complete)' };
  }

  // HTTP response — classify by status.
  if (first.status === 429) {
    // One bounded retry only — if still throttled, hammering makes it worse.
    await new Promise((r) => setTimeout(r, 3_000));
    const second = await attemptOnce(20_000);
    if (second.kind === 'ok') return { ok: true, status: second.status };
    if (second.kind === 'timeout') {
      return { ok: false, unknown: true, error: 'Cloud Run ACK timeout after 429 retry' };
    }
    if (second.status === 429) {
      return { ok: false, rateLimited: true, error: 'Cloud Run 429 rate-limited (twice)' };
    }
  }

  // Real 4xx/5xx → surface to handler to decide.
  const statusText = (first as any).text?.slice?.(0, 500) ?? '';
  return {
    ok: false,
    error: `Cloud Run ${first.status}: ${statusText}`,
    status: first.status,
  };
}

export async function POST(req: Request) {
  try {
    // Require login — renders cost money, don't leave open to the internet
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { html, format, creativeId } = body;

    // ---- Input validation ----
    if (!html || typeof html !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid html' }, { status: 400 });
    }
    if (html.length > MAX_HTML_LEN) {
      return NextResponse.json(
        { error: `HTML too large (${html.length} chars, max ${MAX_HTML_LEN}).` },
        { status: 413 },
      );
    }
    if (!creativeId || typeof creativeId !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid creativeId' }, { status: 400 });
    }
    if (format !== '9:16' && format !== '1:1') {
      return NextResponse.json({ error: 'Invalid format (expected 9:16 or 1:1)' }, { status: 400 });
    }

    // ---- Verify ownership (user can only render their own creatives) ----
    const existing = await db.query.creatives.findFirst({
      where: eq(creatives.id, creativeId),
    });
    if (!existing) {
      return NextResponse.json({ error: 'Creative not found' }, { status: 404 });
    }
    if (existing.userId && existing.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Mark as rendering in the database so other devices (like Mobile phone) can see progress bar!
    const startedAt = Date.now();
    await db
      .update(creatives)
      .set({ videoUrl: `rendering:${startedAt}` })
      .where(eq(creatives.id, creativeId))
      .catch((e) => console.error('Could not update rendering status in DB', e));

    // Tell Cloud Run where to POST the completion webhook. We derive the
    // public URL from the incoming request (handles dev vs prod vs preview
    // envs automatically) and pair it with the shared secret so the Cloud
    // Run service can do a constant-time auth check on callback.
    //
    // If CLOUD_RUN_WEBHOOK_SECRET isn't set, we still send the URL but the
    // secret will be empty → Cloud Run should refuse to call back, and we
    // silently fall back to GCS polling. This is the whole "opt-in" design.
    const webhookSecret = process.env.CLOUD_RUN_WEBHOOK_SECRET || '';
    const webhookBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (req.headers.get('x-forwarded-proto') && req.headers.get('host')
        ? `${req.headers.get('x-forwarded-proto')}://${req.headers.get('host')}`
        : new URL(req.url).origin);
    const webhookUrl = `${webhookBaseUrl.replace(/\/$/, '')}/api/render/webhook`;

    console.log(`[API /render] Posting creativeId=${creativeId} to Cloud Run (with retry)…`);

    const result = await postWithRetry({
      html,
      format,
      creativeId,
      // Extras — Cloud Run can ignore these if it doesn't support callbacks yet.
      webhookUrl,
      webhookSecret,
    });

    // ACK-timeout case: Cloud Run didn't confirm in 45s, but the payload
    // was uploaded and likely accepted. DO NOT mark as failed — keep the
    // DB row as `rendering:<ts>` and let the client's /api/check-render
    // poller detect success when the MP4 lands in GCS (or webhook fires).
    // The 10-min stuck-render watchdog in check-render will clean up if
    // it truly never completes.
    if (!result.ok && result.unknown) {
      console.warn(
        `[API /render] No ACK for ${creativeId} — render status unknown, ` +
        `continuing as if queued. Poller will detect completion.`,
      );
      return NextResponse.json({
        status: 'queued-no-ack',
        creativeId,
        startedAt,
        note: 'Cloud Run did not ACK in time, but the render is likely proceeding. Poll /api/check-render for result.',
      });
    }

    if (!result.ok) {
      // Hard failure (4xx/5xx or double 429). Mark failed so UI stops polling.
      await db
        .update(creatives)
        .set({ videoUrl: `failed:${startedAt}:${(result.error || 'unknown').slice(0, 200)}` })
        .where(eq(creatives.id, creativeId))
        .catch(() => undefined);

      console.error(`[API /render] Cloud Run failed: ${result.error}`);

      const userMessage = result.rateLimited
        ? 'GCP ограничил частоту запросов к серверу рендера. Подожди 10–15 минут — квота сама сбросится. Повторные нажатия сейчас только продлевают блокировку.'
        : 'Сервер рендера вернул ошибку. Проверь статус Cloud Run в GCP Console.';

      return NextResponse.json(
        {
          status: 'failed',
          error: userMessage,
          rateLimited: !!result.rateLimited,
          detail: result.error,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      status: 'queued',
      creativeId,
      startedAt,
      taskName: `DirectProxy-${startedAt}`,
    });
  } catch (error: any) {
    console.error('Error proxying render task:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
