import { NextResponse } from 'next/server';
import { db } from '@/db';
import { creatives } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Webhook endpoint for the Cloud Run renderer.
 *
 * Called by Cloud Run when a render completes (or fails).
 * Secured by a shared secret header; configure CLOUD_RUN_WEBHOOK_SECRET in
 * .env.local AND on the Cloud Run side.
 *
 * Payload shape:
 *   {
 *     "creativeId": "uuid-string",
 *     "status": "done" | "failed",
 *     "videoUrl": "https://storage.googleapis.com/...",  // only for done
 *     "error": "stack or message"                        // only for failed
 *   }
 *
 * Without this webhook configured, /api/check-render still works via GCS
 * polling fallback — this endpoint is a performance / reliability upgrade.
 */
export const dynamic = 'force-dynamic';

/** Constant-time comparison to avoid timing attacks. */
function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const secret = process.env.CLOUD_RUN_WEBHOOK_SECRET;
    if (!secret) {
      console.warn('[render/webhook] CLOUD_RUN_WEBHOOK_SECRET not set — rejecting to fail closed.');
      return NextResponse.json({ error: 'Webhook disabled' }, { status: 503 });
    }

    const provided = req.headers.get('x-webhook-secret') || '';
    if (!safeEq(provided, secret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { creativeId, status, videoUrl, error } = body as {
      creativeId?: string;
      status?: string;
      videoUrl?: string;
      error?: string;
    };

    if (!creativeId || typeof creativeId !== 'string') {
      return NextResponse.json({ error: 'Missing creativeId' }, { status: 400 });
    }

    if (status === 'done') {
      if (!videoUrl || typeof videoUrl !== 'string' || !/^https?:\/\//.test(videoUrl)) {
        return NextResponse.json({ error: 'Invalid videoUrl' }, { status: 400 });
      }
      await db
        .update(creatives)
        .set({ videoUrl })
        .where(eq(creatives.id, creativeId));
      return NextResponse.json({ ok: true });
    }

    if (status === 'failed') {
      const msg = (error || 'render failed').toString().slice(0, 300);
      await db
        .update(creatives)
        .set({ videoUrl: `failed:${Date.now()}:${msg}` })
        .where(eq(creatives.id, creativeId));
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  } catch (e: any) {
    console.error('[render/webhook] Error:', e);
    return NextResponse.json({ error: e.message || 'webhook failure' }, { status: 500 });
  }
}
