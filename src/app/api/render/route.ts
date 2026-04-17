import { NextResponse } from 'next/server';
import { db } from '@/db';
import { creatives } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Ensure this API route is dynamic and never cached
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { html, format, creativeId } = body;

    if (!html || !creativeId) {
      return NextResponse.json({ error: 'Missing html or creativeId' }, { status: 400 });
    }

    // Proxy directly to the Cloud Run server without using Cloud Tasks wrapper
    const url = process.env.CLOUD_RUN_RENDER_URL || 'https://creative-cloud-renderer-694906438875.europe-west4.run.app/gcp/render/task';

    // Mark as rendering in the database so other devices (like Mobile phone) can see progress bar!
    await db.update(creatives)
      .set({ videoUrl: `rendering:${Date.now()}` })
      .where(eq(creatives.id, creativeId))
      .catch(e => console.error("Could not update rendering status in DB", e));

    console.log(`[API /render] Proxying creativeId: ${creativeId} directly to Cloud Run...`);
    
    // We send a direct fire-and-forget HTTP request to the Cloud Run worker
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ html, format, creativeId }),
    }).catch(err => console.error("Cloud Run proxy error:", err));

    return NextResponse.json({ 
        status: 'queued', 
        creativeId, 
        taskName: `DirectProxy-${Date.now()}` 
    });

  } catch (error: any) {
    console.error('Error proxying render task:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
