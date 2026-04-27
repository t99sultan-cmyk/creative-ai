import { db } from "@/db";
import { creatives } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

/**
 * POST /api/select-best
 *
 * The user has compared the Claude vs Gemini sibling outputs side-by-side
 * in the editor and clicked "Это лучше" under one of them. We mark the
 * winner with `selectedAsBest=true` and the loser with `false` — those
 * flags drive both:
 *
 *   1. The public gallery, which only surfaces winners.
 *   2. The model-stats admin view, which computes Claude/Gemini winrate
 *      from these rows.
 *
 * Body: { creativeId } — the winning creative's id.
 *
 * Idempotent: re-selecting the same winner is fine. Selecting the OTHER
 * sibling overwrites the previous choice.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Не авторизован" }), { status: 401 });
    }

    const { creativeId } = await req.json();
    if (typeof creativeId !== "string" || !creativeId) {
      return new Response(JSON.stringify({ error: "creativeId обязателен" }), { status: 400 });
    }

    // Load winner row (must belong to this user, must be in a pair).
    const winnerRows = await db
      .select()
      .from(creatives)
      .where(and(eq(creatives.id, creativeId), eq(creatives.userId, userId)))
      .limit(1);
    const winner = winnerRows[0];
    if (!winner) {
      return new Response(JSON.stringify({ error: "Креатив не найден" }), { status: 404 });
    }
    if (!winner.pairId) {
      return new Response(JSON.stringify({ error: "Этот креатив не из пары" }), { status: 400 });
    }

    // Mark winner.
    await db
      .update(creatives)
      .set({ selectedAsBest: true })
      .where(and(eq(creatives.id, creativeId), eq(creatives.userId, userId)));

    // Mark sibling(s) as loser. Filter on userId for safety.
    await db
      .update(creatives)
      .set({ selectedAsBest: false })
      .where(
        and(
          eq(creatives.pairId, winner.pairId),
          ne(creatives.id, creativeId),
          eq(creatives.userId, userId),
        ),
      );

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[select-best] failed:", error);
    return Response.json(
      { error: error?.message || "Ошибка сохранения выбора" },
      { status: 500 },
    );
  }
}
