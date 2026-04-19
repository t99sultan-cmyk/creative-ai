import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const videoUrl = searchParams.get('url');

    if (!videoUrl) {
      return new NextResponse('Missing url parameter', { status: 400 });
    }

    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
        return new NextResponse('File not found', { status: 404 });
    }

    // Proxy the stream back to the client and force download!
    const headers = new Headers(videoRes.headers);
    // Overwrite the content disposition to force a download instead of playing in browser
    headers.set('Content-Disposition', 'attachment; filename="creative_4k.mp4"');
    headers.set('Content-Type', 'video/mp4');

    return new NextResponse(videoRes.body, {
      status: 200,
      headers
    });
  } catch (error) {
    console.error("Proxy download error:", error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
