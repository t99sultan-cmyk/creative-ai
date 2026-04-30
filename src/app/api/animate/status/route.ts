import { auth } from "@clerk/nextjs/server";
import { checkFalVideo } from "@/lib/models/fal-video";

/**
 * GET /api/animate/status?id=<request_id>
 *
 * Polled by the editor to drive the UI from "queued" → "in_progress" →
 * "completed" (with video URL) or "failed". No DB mutation here — we
 * just proxy fal.ai's queue status and return a normalized shape.
 */
export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Не авторизован" }), { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const requestId = searchParams.get("id");
    if (!requestId) {
      return new Response(JSON.stringify({ error: "id обязателен" }), { status: 400 });
    }

    const status = await checkFalVideo(requestId);
    return new Response(JSON.stringify(status), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[animate/status] failed:", err);
    return new Response(
      JSON.stringify({ state: "failed", error: err?.message || "status error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
