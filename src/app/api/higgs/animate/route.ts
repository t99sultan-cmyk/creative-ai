import { db } from "@/db";
import { creatives, users } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { VIDEO_GEN_COST } from "@/lib/pricing";
import { submitHiggsfieldVideo, type HiggsfieldModelId } from "@/lib/models/higgsfield-video";
import { getHiggsfieldPreset, type HiggsfieldPresetId } from "@/lib/models/higgsfield-presets";

/**
 * POST /api/higgs/animate — kick a Higgsfield image-to-video job.
 *
 * Separate from /api/animate (which uses fal.ai Seedance) so we can run
 * the Higgsfield integration as an isolated "Таргет-ролик" track until
 * we decide how to merge them. Same impulse cost (`VIDEO_GEN_COST`) and
 * same refund-on-submit-failure pattern.
 *
 * Body: { creativeId, presetId?, durationSec?, model? }
 *  - creativeId — required, must belong to the caller
 *  - presetId   — one of HiggsfieldPresetId values (default: "cinematic")
 *  - durationSec — 5 or 10 (default 5)
 *  - model      — optional Higgsfield model_id override (default DoP standard)
 *
 * Returns: { requestId } on success; { error } with proper status otherwise.
 *
 * Status polling lives at /api/higgs/animate/status?id={requestId}.
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
    const durationSec: 5 | 10 = body?.durationSec === 10 ? 10 : 5;
    const modelOverride = typeof body?.model === "string" ? (body.model as HiggsfieldModelId) : undefined;
    if (!creativeId) {
      return new Response(JSON.stringify({ error: "creativeId обязателен" }), { status: 400 });
    }

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
    // Higgsfield wants a public HTTP URL, not a data: URI. Reject early
    // if for some reason imageUrl is inline (shouldn't happen — generate
    // route uploads to GCS — but defensive in case of legacy creatives).
    if (source.imageUrl.startsWith("data:")) {
      return new Response(
        JSON.stringify({ error: "Higgsfield требует публичный URL картинки. Сначала пересохрани креатив." }),
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

    const preset = getHiggsfieldPreset(presetId as HiggsfieldPresetId | null);
    const prompt = `${preset.prompt} Original brief: ${source.prompt}`;

    const requestId = await submitHiggsfieldVideo(
      {
        imageUrl: source.imageUrl,
        prompt,
        duration: durationSec,
      },
      { model: modelOverride },
    );

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
        console.error("[higgs/animate] refund failed:", refundErr);
      }
    }
    console.error("[higgs/animate] failed:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Ошибка запуска Higgsfield" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
