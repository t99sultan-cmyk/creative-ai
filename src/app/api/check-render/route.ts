import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const creativeId = searchParams.get('id');

    if (!creativeId) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const testUrl = `https://storage.googleapis.com/${process.env.NEXT_PUBLIC_GCP_BUCKET || 'creative-coder-outputs-dev'}/renders/${creativeId}.mp4`;
    // We ping the file server-side to bypass any CORS restrictions from Google Cloud Storage
    const checkRes = await fetch(testUrl, { method: 'HEAD', cache: 'no-store' });

    if (checkRes.ok) {
      return NextResponse.json({ ready: true, url: testUrl });
    } else {
      return NextResponse.json({ ready: false });
    }
  } catch (error) {
    console.error("Check render error:", error);
    return NextResponse.json({ ready: false, error: 'Network error' });
  }
}
