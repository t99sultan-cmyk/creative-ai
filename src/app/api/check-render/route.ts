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

    if (row?.videoUrl) {
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

      // Still rendering — check for timeout
      if (v.startsWith('rendering:')) {
        const ts = parseInt(v.slice('rendering:'.length), 10);
        if (Number.isFinite(ts) && Date.now() - ts > STUCK_RENDER_THRESHOLD_MS) {
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
      }
    }

    // ---- Fallback: ping GCS directly. Legacy behavior, covers the case
    // where Cloud Run doesn't call the webhook yet.
    const bucket = process.env.NEXT_PUBLIC_GCP_BUCKET || 'creative-coder-outputs-dev';
    const testUrl = `https://storage.googleapis.com/${bucket}/renders/${creativeId}.mp4`;
    const checkRes = await fetch(testUrl, { method: 'HEAD', cache: 'no-store' });

    if (checkRes.ok) {
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
