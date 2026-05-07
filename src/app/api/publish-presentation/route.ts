import { auth } from "@clerk/nextjs/server";
import { publishPage } from "@/lib/published-store";

/**
 * POST /api/publish-presentation — saves a generated deck's HTML to
 * the in-memory store and returns its public URL. Body: { html }.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Не авторизован" }), { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const html = typeof body?.html === "string" ? body.html : "";
    if (!html || html.length < 200) {
      return new Response(JSON.stringify({ error: "Пустой или слишком короткий HTML" }), { status: 400 });
    }
    const page = await publishPage({ kind: "presentation", html, userId });
    return new Response(
      JSON.stringify({
        slug: page.slug,
        path: `/p/${page.slug}`,
        url: `/p/${page.slug}`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[publish-presentation] failed:", err);
    return new Response(JSON.stringify({ error: err?.message || "Ошибка публикации" }), { status: 500 });
  }
}
