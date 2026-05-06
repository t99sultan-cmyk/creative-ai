import { auth } from "@clerk/nextjs/server";
import { checkHiggsfieldVideo } from "@/lib/models/higgsfield-video";

/**
 * GET /api/higgs/animate/status?id={requestId}
 *
 * Polled by the editor every few seconds while a Higgsfield job is in
 * flight. Returns one of:
 *   { state: "queued" | "in_progress" }
 *   { state: "completed", videoUrl }
 *   { state: "failed", error }
 *
 * No DB writes here — we deliberately do not persist the resulting video
 * URL on the creative until the user explicitly chooses to keep it (TBD;
 * for the local test phase the editor just plays the URL directly).
 */
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Не авторизован" }), { status: 401 });
  }
  const url = new URL(req.url);
  const requestId = url.searchParams.get("id");
  if (!requestId) {
    return new Response(JSON.stringify({ error: "id обязателен" }), { status: 400 });
  }
  try {
    const status = await checkHiggsfieldVideo(requestId);
    return new Response(JSON.stringify(status), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[higgs/animate/status] failed:", err);
    return new Response(
      JSON.stringify({ state: "failed", error: err?.message || "status failed" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
}
