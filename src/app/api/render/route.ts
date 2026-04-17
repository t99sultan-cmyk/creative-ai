import { NextResponse } from 'next/server';
import { CloudTasksClient } from '@google-cloud/tasks';

// Ensure this API route is dynamic and never cached
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { html, format, creativeId } = body;

    if (!html || !creativeId) {
      return NextResponse.json({ error: 'Missing html or creativeId' }, { status: 400 });
    }

    // Google Cloud setup 
    // Requires GOOGLE_APPLICATION_CREDENTIALS env var containing the JSON path
    // Or set GOOGLE_CLOUD_PROJECT, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY
    const client = new CloudTasksClient();

    // Configuration for the queue - provided by ENV
    const project = process.env.GOOGLE_CLOUD_PROJECT || 'creative-coder-app';
    const queue = process.env.GOOGLE_CLOUD_QUEUE || 'render-queue';
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'europe-west1';
    
    // The deployed Cloud Run backend target
    const url = process.env.CLOUD_RUN_RENDER_URL || 'https://creative-cloud-renderer-694906438875.europe-west4.run.app/gcp/render/task';

    // Construct the fully qualified queue name.
    const parent = client.queuePath(project, location, queue);

    const task = {
      httpRequest: {
        httpMethod: 'POST' as const,
        url,
        headers: {
          'Content-Type': 'application/json',
        },
        body: Buffer.from(JSON.stringify({ html, format, creativeId })).toString('base64'),
        // Cloud Run has a max timeout of 60 mins. We allow Timecut + FFmpeg up to 5 mins.
        dispatchDeadline: {
            seconds: 5 * 60,
        }
      },
    };

    console.log(`[API /render] Queueing creativeId: ${creativeId} in Google Cloud Tasks...`);
    
    // Send create task request
    // @ts-ignore
    const [response] = await client.createTask({ parent, task });
    
    console.log(`Created task ${response.name}`);

    return NextResponse.json({ 
        status: 'queued', 
        creativeId, 
        taskName: response.name 
    });

  } catch (error: any) {
    console.error('Error queuing task:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
