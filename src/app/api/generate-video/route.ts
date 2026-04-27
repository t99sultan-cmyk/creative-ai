import { db } from "@/db";
import { users, creatives } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import crypto from "crypto";
import { isAdmin } from "@/lib/admin-guard";
import { VIDEO_GEN_COST } from "@/lib/pricing";
import { notifyAdmin, fmt } from "@/lib/admin-notify";

export const maxDuration = 60; // we just kick the job; client polls

const KZT_PER_USD = 480;

/**
 * POST /api/generate-video — Veo 3 video generation (KICK).
 *
 * Вео работает асинхронно: возвращает `operation` с длинным run-id,
 * который надо poll'ить через GET /api/check-video?operationId=...
 * до готовности. Юзер видит progress-bar в UI; когда видео готово —
 * скачивается MP4.
 *
 * Body:
 *   • sourceCreativeId — id креатива-победителя (Claude/Gemini/Imagen),
 *     по которому делаем видео-расширение
 *   • prompt — оригинальный бриф юзера (передаётся в Veo)
 *   • aspectRatio — "9:16" | "1:1"
 *
 * Response: { operationId, sourceCreativeId } — клиент держит этот
 * operationId и каждые ~5 сек poll'ит /api/check-video.
 *
 * Cost: VIDEO_GEN_COST (50 имп.) — списывается СРАЗУ при кике, не при
 * получении результата. На случай провала видео — refund в /check-video.
 *
 * Anti-abuse: source creative должен принадлежать юзеру и быть создан
 * в последние 24 часа (anti-replay).
 */
export async function POST(req: Request) {
  let deductedUserId: string | null = null;
  let deductedCost = 0;
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Не авторизован" }), { status: 401 });
    }

    const body = await req.json();
    const { sourceCreativeId, prompt, aspectRatio } = body;

    if (typeof sourceCreativeId !== "string" || !sourceCreativeId) {
      return new Response(JSON.stringify({ error: "sourceCreativeId обязателен" }), { status: 400 });
    }
    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Промпт пустой" }), { status: 400 });
    }
    if (aspectRatio !== "9:16" && aspectRatio !== "1:1") {
      return new Response(JSON.stringify({ error: "Неверный формат" }), { status: 400 });
    }

    // ---- Anti-abuse: verify ownership + 24h window ----
    const sourceRows = await db
      .select()
      .from(creatives)
      .where(and(eq(creatives.id, sourceCreativeId), eq(creatives.userId, userId)))
      .limit(1);
    const source = sourceRows[0];
    if (!source) {
      return new Response(JSON.stringify({ error: "Креатив не найден" }), { status: 404 });
    }
    if (source.createdAt) {
      const ageMs = Date.now() - new Date(source.createdAt).getTime();
      if (ageMs > 24 * 3600 * 1000) {
        return new Response(
          JSON.stringify({ error: "Слишком старый креатив (>24ч). Сгенерируй заново и сделай видео сразу." }),
          { status: 403 },
        );
      }
    }

    // Block double-video: if the source already has a child creative
    // marked as video, refuse (one video per source).
    const existingVideoChildren = await db
      .select({ id: creatives.id })
      .from(creatives)
      .where(
        and(
          eq(creatives.parentCreativeId, sourceCreativeId),
          sql`${creatives.videoUrl} IS NOT NULL`,
        ),
      )
      .limit(1);
    if (existingVideoChildren.length > 0) {
      return new Response(
        JSON.stringify({ error: "Видео для этого креатива уже сделано." }),
        { status: 409 },
      );
    }

    // Admin bypass for cost (testing).
    const adminBypass = await isAdmin();
    const cost = adminBypass ? 0 : VIDEO_GEN_COST;

    if (cost > 0) {
      const deducted = await db
        .update(users)
        .set({ impulses: sql`${users.impulses} - ${cost}` })
        .where(and(eq(users.id, userId), gte(users.impulses, cost)))
        .returning({ impulses: users.impulses });
      if (deducted.length === 0) {
        return new Response(
          JSON.stringify({
            error: `Недостаточно импульсов. Видео стоит ${VIDEO_GEN_COST} имп.`,
          }),
          { status: 400 },
        );
      }
      deductedUserId = userId;
      deductedCost = cost;
    }

    // ---- Kick Veo 3 generation ----
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is missing");

    // Veo 3 API: long-running operation. Returns { name: "operations/..." }
    // immediately. Client polls separately.
    const veoRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/veo-3.0-generate-001:predictLongRunning?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [
            {
              prompt: `Advertising creative: ${prompt}. High-quality, dynamic, modern 2026 visual style.`,
            },
          ],
          parameters: {
            aspectRatio,
            // 8 sec is the Veo 3 default duration cap.
            durationSeconds: 8,
            // Allow people in the frame.
            personGeneration: "allow_adult",
          },
        }),
      },
    );

    if (!veoRes.ok) {
      const errText = await veoRes.text();
      throw new Error(`Veo 3 API error (${veoRes.status}): ${errText.slice(0, 300)}`);
    }

    const veoData = await veoRes.json();
    const operationName = veoData?.name as string | undefined;
    if (!operationName) {
      throw new Error(`Veo 3 returned no operation name: ${JSON.stringify(veoData).slice(0, 200)}`);
    }

    // Pre-create a "pending" creative row for this video so the editor
    // can show it in history immediately. videoUrl gets the
    // "rendering:<timestamp>" placeholder same as the legacy Cloud Run
    // path uses — the existing client polling already handles this.
    const newCreativeId = crypto.randomUUID();
    await db.insert(creatives).values({
      id: newCreativeId,
      userId,
      prompt,
      format: aspectRatio,
      cost: deductedCost, // reflect what was actually charged
      apiCostKzt: 0, // updated after Veo finishes
      videoUrl: `veo-pending:${operationName}`,
      model: "veo",
      parentCreativeId: sourceCreativeId,
    });

    // Mark deduction committed.
    deductedCost = 0;

    void (async () => {
      try {
        notifyAdmin(
          `🎬 *Veo 3 видео — старт*\n\n*Юзер:* ${fmt.esc(userId)}\n*Source:* \`${sourceCreativeId}\`\n*Operation:* \`${operationName}\`\n*Cost:* ${VIDEO_GEN_COST} имп.\n*ТЗ:* ${fmt.esc(fmt.short(prompt, 200))}`,
        );
      } catch {}
    })().catch(() => undefined);

    return new Response(
      JSON.stringify({
        creativeId: newCreativeId,
        operationName,
        sourceCreativeId,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    if (deductedCost > 0 && deductedUserId) {
      try {
        await db
          .update(users)
          .set({ impulses: sql`${users.impulses} + ${deductedCost}` })
          .where(eq(users.id, deductedUserId));
        console.warn(`[video refund] returned ${deductedCost} imp.`);
      } catch (refundErr) {
        console.error(`[video refund FAILED]`, { userId: deductedUserId, deductedCost, refundErr });
      }
    }
    console.error("[generate-video] error:", error);

    try {
      notifyAdmin(
        `🔴 *Veo 3 — ошибка старта*\n\n*Юзер:* ${fmt.esc(deductedUserId ?? "?")}\n*Ошибка:* ${fmt.esc(fmt.short(error?.message || String(error), 250))}\n` +
          (deductedCost > 0 ? `\n_Импульсы (${deductedCost}) возвращены._` : ""),
      );
    } catch {}

    return Response.json(
      { error: error?.message || "Не удалось запустить генерацию видео." },
      { status: 500 },
    );
  }
}
