import { NextResponse } from 'next/server';
import { db } from '@/db';
import { creatives } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * After this many minutes we consider a still-pending render "stuck".
 * Cloud Run renders usually finish within 1-2 min; 10 min is a safe cut-off.
 */
const STUCK_RENDER_THRESHOLD_MS = 10 * 60 * 1000;

/**
 * Cloud Run renders are NEVER faster than this. Before this threshold we
 * don't even bother hitting GCS — we just report "not ready yet". This
 * saves 1-3 sec of GCS HEAD latency per poll on the early phase.
 *
 * Empirically: a 9:16 video (450 frames) takes 180-240s end-to-end,
 * a 1:1 (300 frames) takes 120-180s. So "too early to check" = 45s.
 */
const MIN_RENDER_TIME_MS = 45_000;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const creativeId = searchParams.get('id');

    if (!creativeId) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    // ---- First: check DB state. If webhook has already reported completion
    // or failure, we can answer without hitting GCS.
    const row = await db.query.creatives.findFirst({
      where: eq(creatives.id, creativeId),
    });

    // Creative doesn't exist at all (client has a stale id in localStorage).
    if (!row) {
      return NextResponse.json({
        ready: false,
        notStarted: true,
        error: 'Креатив не найден',
      });
    }

    // Creative exists but videoUrl is empty — render was never started for
    // it, or was manually cleared. The client is in a "zombie poll" state
    // where localStorage says "rendering" but the DB has nothing to show.
    // Tell the client to drop the job from its queue.
    if (!row.videoUrl) {
      return NextResponse.json({
        ready: false,
        notStarted: true,
        error: 'Рендер не был запущен для этого креатива',
      });
    }

    const v = row.videoUrl;

    // Webhook-delivered success: videoUrl is a real URL (http...)
    if (v.startsWith('http://') || v.startsWith('https://')) {
      return NextResponse.json({ ready: true, url: v, source: 'db' });
    }

    // Explicit failure flag from /api/render
    if (v.startsWith('failed:')) {
      return NextResponse.json({
        ready: false,
        failed: true,
        error: v.slice('failed:'.length).split(':').slice(1).join(':') || 'Render failed',
      });
    }

    // Still rendering: check timeout, then decide whether to ping GCS at all.
    if (v.startsWith('rendering:')) {
      const ts = parseInt(v.slice('rendering:'.length), 10);
      const elapsed = Number.isFinite(ts) ? Date.now() - ts : 0;

      if (elapsed > STUCK_RENDER_THRESHOLD_MS) {
        // Mark as failed so the UI stops polling forever
        await db
          .update(creatives)
          .set({ videoUrl: `failed:${ts}:stuck-render-timeout` })
          .where(eq(creatives.id, creativeId))
          .catch(() => undefined);
        return NextResponse.json({
          ready: false,
          failed: true,
          error: 'Рендер завис (>10 мин). Попробуй запустить снова.',
        });
      }

      // Too early to bother GCS. This is the single biggest check-render
      // speedup — we answer in ~10ms (DB only) for the first ~45 seconds
      // instead of adding a 1-3s GCS HEAD round-trip to every poll.
      if (elapsed < MIN_RENDER_TIME_MS) {
        return NextResponse.json({
          ready: false,
          source: 'db-early',
          elapsedMs: elapsed,
        });
      }
    }

    // ---- Fallback: ping GCS directly. Legacy behavior, covers the case
    // where Cloud Run doesn't call the webhook yet.
    const bucket = process.env.NEXT_PUBLIC_GCP_BUCKET || 'creative-coder-outputs-dev';
    const testUrl = `https://storage.googleapis.com/${bucket}/renders/${creativeId}.mp4`;

    // Short timeout — if GCS is slow, we'd rather answer "not ready" quickly
    // than block the poll for 10+ seconds.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);

    let checkRes: Response | null = null;
    try {
      checkRes = await fetch(testUrl, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });
    } catch {
      // Timeout or network error — treat as not ready, poll will retry.
    } finally {
      clearTimeout(timer);
    }

    if (checkRes?.ok) {
      // Cache the URL in DB so subsequent polls skip GCS
      await db
        .update(creatives)
        .set({ videoUrl: testUrl })
        .where(eq(creatives.id, creativeId))
        .catch(() => undefined);
      return NextResponse.json({ ready: true, url: testUrl, source: 'gcs' });
    }

    return NextResponse.json({ ready: false });
  } catch (error) {
    console.error('Check render error:', error);
    return NextResponse.json({ ready: false, error: 'Network error' });
  }
}
