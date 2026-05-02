import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  // Global cap on request body size. Next.js 16 defaults to 10 MB and will
  // silently TRUNCATE anything larger — the handler then sees a broken JSON
  // and returns a confusing error. We bump to 25 MB so that:
  //   - POST /api/render can ship creatives with 4 × ~2 MB base64 product
  //     images (post-bg-removal + WebP), total ~8-12 MB.
  //   - POST /api/generate can ship remix context with embedded images.
  // Cloud Run and Claude both accept well over 25 MB per request.
  // Note: `middlewareClientMaxBodySize` was renamed to `proxyClientMaxBodySize`
  // in Next.js 16; we use the new name and keep both under `experimental.*`.
  experimental: {
    proxyClientMaxBodySize: '25mb',
    // Server Actions (e.g. generateTzBrief, analyzeProductForBrief)
    // accept the uploaded product photo as a base64 data URL. WebP at
    // 1024×1024 fits in ~500 KB but a high-res phone JPEG can hit
    // 2-4 MB. Default 1 MB blew up "Body exceeded 1 MB limit" for
    // any non-trivial upload — bump to 10 MB so the brief flow works
    // for real-world photos while still bounded.
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [375, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|jpeg|png|webp|avif|mp4|woff2?)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
