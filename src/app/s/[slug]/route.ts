import { getPublishedPage } from "@/lib/published-store";

/**
 * GET /s/{slug} — public site preview. Returns the raw HTML of the
 * published landing as the entire document body. No Next.js layout
 * shell, no auth — anyone with the URL can view (that's the point of
 * publishing).
 *
 * v1: reads from in-memory store. v2: reads from DB.
 *
 * NOTE: this is a Route Handler (route.ts) at a page-style segment.
 * In Next 13+, route.ts wins over page.tsx at the same path, so the
 * URL serves raw HTML directly without a Next.js wrapper.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const page = await getPublishedPage("site", slug);
  if (!page) {
    return new Response(notFoundHtml("Сайт не найден или его публикация истекла."), {
      status: 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
  return new Response(page.html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // No-store while we're on the in-memory store — prevents stale
      // copies surviving server restarts. v2 (DB) can switch to
      // public, max-age=300.
      "Cache-Control": "no-store",
    },
  });
}

function notFoundHtml(message: string): string {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Не найдено · AICreative</title><style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#fafafa;color:#0a0a0a;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}.card{max-width:480px;background:#fff;border:1px solid #e5e5e5;border-radius:24px;padding:32px;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.06)}h1{font-size:24px;margin:0 0 8px;font-weight:900;letter-spacing:-0.02em}p{color:#737373;margin:0 0 24px;line-height:1.5}a{display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:12px}</style></head><body><div class="card"><h1>Не найдено</h1><p>${message}</p><a href="/">На главную</a></div></body></html>`;
}
