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
 * POST request to Cloud Run with retry + exponential backoff.
 * Returns true if Cloud Run acked the job (any 2xx/202), false on total failure.
 *
 * We don't wait for render completion here — just for the "accepted" handshake.
 * Render progress is tracked via polling /api/check-render + GCS bucket.
 */
async function postWithRetry(body: any, maxRetries = 3): Promise<{ ok: boolean; error?: string; status?: number }> {
  let lastErr: any = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000); // 20s handshake window

      const res = await fetch(CLOUD_RUN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) return { ok: true, status: res.status };

      // 429 is a rate-limit — retryable, not a client bug. Honor
      // Retry-After when Cloud Run sends it, otherwise fall back to the
      // exponential backoff below (but with a bigger minimum wait).
      if (res.status === 429) {
        const retryAfterHeader = res.headers.get('retry-after');
        const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
        const waitMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
          ? Math.min(30_000, retryAfterSec * 1000)
          : Math.min(15_000, 3_000 * Math.pow(2, attempt));
        console.warn(`[Cloud Run 429] rate-limited, backing off ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`);
        lastErr = new Error(`Cloud Run 429 rate-limited`);
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, waitMs));
        }
        continue;
      }

      // Other 4xx → don't retry (real client error — bad html, bad format, etc).
      if (res.status >= 400 && res.status < 500) {
        const text = await res.text().catch(() => '');
        return { ok: false, error: `Cloud Run 4xx: ${res.status} ${text}`.slice(0, 500), status: res.status };
      }

      lastErr = new Error(`Cloud Run ${res.status}`);
    } catch (e: any) {
      lastErr = e;
    }

    // Exponential backoff: 1s, 2s, 4s
    if (attempt < maxRetries - 1) {
      const delay = Math.min(5000, 1000 * Math.pow(2, attempt));
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return { ok: false, error: lastErr?.message || 'Cloud Run unreachable' };
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

    if (!result.ok) {
      // Mark as failed so the UI stops polling forever
      await db
        .update(creatives)
        .set({ videoUrl: `failed:${startedAt}:${(result.error || 'unknown').slice(0, 200)}` })
        .where(eq(creatives.id, creativeId))
        .catch(() => undefined);

      console.error(`[API /render] Cloud Run failed after retries: ${result.error}`);

      return NextResponse.json(
        {
          status: 'failed',
          error: 'Сервер рендера недоступен. Попробуй ещё раз через пару минут.',
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
