import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { callFalAudio } from "@/lib/models/fal-audio";

/**
 * POST /api/sound — adds a generated audio track to a video via fal.ai
 * MMAudio v2. Synchronous: blocks until done (~20-60 sec) and returns
 * the new MP4 URL.
 *
 * Body: { videoUrl, prompt? }
 *
 * Charges SOUND_COST impulses upfront, refunds on failure.
 */

const SOUND_COST = 5;
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
    const prompt = typeof body?.prompt === "string" ? body.prompt.slice(0, 240) : undefined;
    if (!videoUrl) {
      return new Response(JSON.stringify({ error: "videoUrl обязателен" }), { status: 400 });
    }

    // Atomic deduct.
    const cost = SOUND_COST;
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

    const { videoUrl: outputUrl } = await callFalAudio({ videoUrl, prompt });

    deductedCost = 0; // Success — keep the deduction.
    return new Response(
      JSON.stringify({ ok: true, videoUrl: outputUrl }),
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
        console.error("[sound] refund failed:", refundErr);
      }
    }
    console.error("[sound] failed:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Ошибка добавления звука" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
