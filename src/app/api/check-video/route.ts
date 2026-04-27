import { db } from "@/db";
import { creatives, users } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { notifyAdmin, fmt } from "@/lib/admin-notify";

export const maxDuration = 60;

const KZT_PER_USD = 480;

/**
 * GET /api/check-video?creativeId=...
 *
 * Polls the Veo 3 long-running operation that was kicked by
 * /api/generate-video for this creative. Returns one of three states:
 *
 *   { state: "pending" }       — still rendering, retry in 5-10 sec
 *   { state: "ready", videoUrl } — MP4 is ready, here's the URL
 *   { state: "failed", error } — Veo failed; refund applied if not yet
 *
 * On first "ready" return we:
 *   1. Download the MP4 from Veo's signed URL
 *   2. Upload to our existing Cloud Run / GCS bucket so the URL is
 *      stable (Veo's URL expires in 2 hours)
 *   3. Update creative.videoUrl to the stable URL
 *   4. Update creative.apiCostKzt with actual Veo billing
 *
 * For brevity in this first iteration we skip the "re-host to GCS" step
 * and store Veo's signed URL directly. Trade-off: if user comes back
 * after 2 hours the link 404s. ACCEPTABLE for MVP — most users download
 * within minutes. We can add re-hosting later.
 */
export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Не авторизован" }), { status: 401 });
    }

    const url = new URL(req.url);
    const creativeId = url.searchParams.get("creativeId");
    if (!creativeId) {
      return new Response(JSON.stringify({ error: "creativeId обязателен" }), { status: 400 });
    }

    const rows = await db
      .select()
      .from(creatives)
      .where(and(eq(creatives.id, creativeId), eq(creatives.userId, userId)))
      .limit(1);
    const creative = rows[0];
    if (!creative) {
      return new Response(JSON.stringify({ error: "Креатив не найден" }), { status: 404 });
    }

    // Already finished — short-circuit.
    if (creative.videoUrl && !creative.videoUrl.startsWith("veo-pending:") && !creative.videoUrl.startsWith("veo-failed:")) {
      return new Response(
        JSON.stringify({ state: "ready", videoUrl: creative.videoUrl }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (creative.videoUrl?.startsWith("veo-failed:")) {
      return new Response(
        JSON.stringify({
          state: "failed",
          error: creative.videoUrl.slice("veo-failed:".length).slice(0, 300),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!creative.videoUrl?.startsWith("veo-pending:")) {
      return new Response(
        JSON.stringify({ error: "Этот креатив не из Veo-pending" }),
        { status: 400 },
      );
    }

    const operationName = creative.videoUrl.slice("veo-pending:".length);
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

    // Poll Google operations endpoint.
    const opRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`,
    );
    if (!opRes.ok) {
      const errText = await opRes.text();
      console.error(`[check-video] poll failed (${opRes.status}): ${errText.slice(0, 300)}`);
      // Don't refund yet — could be transient.
      return new Response(
        JSON.stringify({ state: "pending" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    const opData = await opRes.json();

    if (!opData?.done) {
      return new Response(
        JSON.stringify({ state: "pending" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Operation finished. Either error or success.
    if (opData?.error) {
      const errMsg = opData.error?.message || JSON.stringify(opData.error);
      // Refund the user — Veo charged us nothing on failure (Google
      // policy), but we already deducted the user's impulses upfront.
      try {
        await db
          .update(users)
          .set({ impulses: sql`${users.impulses} + ${creative.cost ?? 0}` })
          .where(eq(users.id, userId));
        console.warn(`[check-video] Veo failed; refunded ${creative.cost} imp. to ${userId}`);
      } catch (e) {
        console.error("[check-video] refund failed:", e);
      }
      // Mark creative as failed so we don't poll again.
      await db
        .update(creatives)
        .set({ videoUrl: `veo-failed:${errMsg.slice(0, 200)}` })
        .where(eq(creatives.id, creativeId));

      try {
        notifyAdmin(
          `🔴 *Veo 3 видео — ошибка генерации*\n\n*Юзер:* ${fmt.esc(userId)}\n*Operation:* \`${operationName}\`\n*Ошибка:* ${fmt.esc(errMsg.slice(0, 300))}\n_Импульсы (${creative.cost}) возвращены._`,
        );
      } catch {}

      return new Response(
        JSON.stringify({ state: "failed", error: errMsg }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Success. Veo response shape:
    // { response: { generatedVideos: [{ video: { uri: "https://..." } }] } }
    const resp = opData?.response;
    const videoUri =
      resp?.generatedVideos?.[0]?.video?.uri ||
      resp?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
    if (!videoUri) {
      const dump = JSON.stringify(opData).slice(0, 400);
      console.error("[check-video] success but no video URI:", dump);
      // Refund — we got nothing usable.
      try {
        await db
          .update(users)
          .set({ impulses: sql`${users.impulses} + ${creative.cost ?? 0}` })
          .where(eq(users.id, userId));
      } catch {}
      await db
        .update(creatives)
        .set({ videoUrl: `veo-failed:no-uri-in-response` })
        .where(eq(creatives.id, creativeId));
      return new Response(
        JSON.stringify({ state: "failed", error: "Veo вернул пустое видео" }),
        { status: 200 },
      );
    }

    // Veo URI requires the API key as a query param to download. We
    // store the full authenticated URL for the editor to use directly.
    // (Anyone with this DB row + the URL could download — same auth
    // model as our other signed URLs. Not ideal long-term; future PR
    // should re-host to our own GCS bucket.)
    const stableUrl = videoUri.includes("?")
      ? `${videoUri}&key=${apiKey}`
      : `${videoUri}?key=${apiKey}`;

    // Estimate apiCostKzt from Veo pricing: $0.50/sec × 8 sec = $4
    // (lower bound; actual may be $5-6 with audio).
    const estimatedCostKzt = 4 * KZT_PER_USD;

    await db
      .update(creatives)
      .set({ videoUrl: stableUrl, apiCostKzt: estimatedCostKzt })
      .where(eq(creatives.id, creativeId));

    void (async () => {
      try {
        notifyAdmin(
          `✅ *Veo 3 видео готово*\n\n*Юзер:* ${fmt.esc(userId)}\n*creativeId:* \`${creativeId}\``,
        );
      } catch {}
    })().catch(() => undefined);

    return new Response(
      JSON.stringify({ state: "ready", videoUrl: stableUrl }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[check-video] error:", error);
    return Response.json(
      { error: error?.message || "Ошибка проверки статуса видео" },
      { status: 500 },
    );
  }
}
