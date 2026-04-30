import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";

/**
 * POST /api/text-overlay
 *
 * Proxies an authenticated request to the Cloud Run /text-overlay
 * endpoint, which renders Remotion text on top of the source video.
 * Charges a flat impulse cost (cheap — only Cloud Run + GCS, no
 * per-frame API). Synchronous: blocks until the renderer returns
 * the new video URL. Render takes ~10-30 sec for a 5-sec clip.
 *
 * Body: { videoUrl, text, accent?, width?, height?, durationSec? }
 *
 * The `videoUrl` should be the fal.ai output (or any public MP4 URL).
 */

const TEXT_OVERLAY_COST = 5; // Impulses. Roughly $0.02 of Cloud Run + GCS.

const RENDERER_URL =
  process.env.CLOUD_RUN_RENDER_URL?.replace(/\/gcp\/render\/task$/, "") ||
  "https://creative-cloud-renderer-694906438875.europe-west4.run.app";

export const maxDuration = 300;

export async function POST(req: Request) {
  let deductedUserId: string | null = null;
  let deductedCost = 0;
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Не авторизован" }), { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const videoUrl = typeof body?.videoUrl === "string" ? body.videoUrl : null;
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!videoUrl || !text) {
      return new Response(
        JSON.stringify({ error: "videoUrl и text обязательны" }),
        { status: 400 },
      );
    }
    if (text.length > 120) {
      return new Response(
        JSON.stringify({ error: "Текст слишком длинный (максимум 120 симв.)." }),
        { status: 400 },
      );
    }

    // Atomic deduct.
    const cost = TEXT_OVERLAY_COST;
    const deducted = await db
      .update(users)
      .set({ impulses: sql`${users.impulses} - ${cost}` })
      .where(and(eq(users.id, userId), gte(users.impulses, cost)))
      .returning({ impulses: users.impulses });
    if (deducted.length === 0) {
      return new Response(
        JSON.stringify({ error: `Нужно ${cost} импульсов на балансе.` }),
        { status: 400 },
      );
    }
    deductedUserId = userId;
    deductedCost = cost;

    const upstream = await fetch(`${RENDERER_URL}/text-overlay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoUrl,
        text,
        accent: typeof body?.accent === "string" ? body.accent : undefined,
        width: typeof body?.width === "number" ? body.width : undefined,
        height: typeof body?.height === "number" ? body.height : undefined,
        durationSec: typeof body?.durationSec === "number" ? body.durationSec : undefined,
        fps: typeof body?.fps === "number" ? body.fps : undefined,
      }),
      signal: AbortSignal.timeout(280_000),
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => "");
      throw new Error(`renderer ${upstream.status}: ${errText.slice(0, 400)}`);
    }
    const data = await upstream.json();
    if (!data?.ok || !data?.videoUrl) {
      throw new Error(`renderer returned no videoUrl: ${JSON.stringify(data).slice(0, 300)}`);
    }

    deductedCost = 0; // Success — keep deduction.
    return new Response(
      JSON.stringify({ ok: true, videoUrl: data.videoUrl, jobId: data.jobId }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    if (deductedCost > 0 && deductedUserId) {
      try {
        await db
          .update(users)
          .set({ impulses: sql`${users.impulses} + ${deductedCost}` })
          .where(eq(users.id, deductedUserId));
      } catch (refundErr) {
        console.error("[text-overlay] refund failed:", refundErr);
      }
    }
    console.error("[text-overlay] failed:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Ошибка наложения текста" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
