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
