import { db } from "@/db";
import { creatives, users } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { VIDEO_GEN_COST } from "@/lib/pricing";
import { submitFalVideo } from "@/lib/models/fal-video";
import { getAnimationPreset } from "@/lib/models/animation-presets";

/**
 * POST /api/animate — kick an image-to-video job on fal.ai
 * (Seedance 2.0 Fast).
 *
 * Body: { creativeId, presetId? } — presetId is one of the
 * AnimationPresetId values in `lib/models/animation-presets.ts`.
 * If omitted, falls back to the "subtle" universal preset.
 *
 * We deliberately do NOT accept free-form prompts from the client —
 * preset → hardcoded English prompt mapping happens server-side. This
 * gives consistent results and keeps users from spending money on
 * malformed/abusive prompts.
 *
 * Charges VIDEO_GEN_COST impulses upfront (refunded on submit failure).
 *
 * Returns: { requestId } on success.
 */
export async function POST(req: Request) {
  let deductedUserId: string | null = null;
  let deductedCost = 0;
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Не авторизован" }), { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const creativeId = typeof body?.creativeId === "string" ? body.creativeId : null;
    const presetId = typeof body?.presetId === "string" ? body.presetId : null;
    // 10-sec costs about 2× the 5-sec on Seedance — but the impulse
    // charge is the same flat VIDEO_GEN_COST for both for now. Tune
    // later if margins suffer.
    const durationSec: 5 | 10 = body?.durationSec === 10 ? 10 : 5;
    if (!creativeId) {
      return new Response(JSON.stringify({ error: "creativeId обязателен" }), { status: 400 });
    }

    // Fetch source creative and verify ownership.
    const rows = await db
      .select()
      .from(creatives)
      .where(and(eq(creatives.id, creativeId), eq(creatives.userId, userId)))
      .limit(1);
    const source = rows[0];
    if (!source) {
      return new Response(JSON.stringify({ error: "Креатив не найден" }), { status: 404 });
    }
    if (!source.imageUrl) {
      return new Response(
        JSON.stringify({ error: "У этого креатива нет картинки для анимации." }),
        { status: 400 },
      );
    }

    // Atomic deduct.
    const cost = VIDEO_GEN_COST;
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

    // Hardcoded preset prompt + the original brief as context. The
    // preset prompt steers the motion style; the brief tells the model
    // what the creative is about (helps it animate appropriately).
    const preset = getAnimationPreset(presetId);
    const prompt = `${preset.prompt} Original brief: ${source.prompt}`;

    const requestId = await submitFalVideo({
      imageUrl: source.imageUrl,
      prompt,
      duration: durationSec,
    });

    return new Response(
      JSON.stringify({ requestId, sourceCreativeId: creativeId, cost }),
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
        console.error("[animate] refund failed:", refundErr);
      }
    }
    console.error("[animate] failed:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Ошибка запуска анимации" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
