"use server";

import { db } from "@/db";
import { creatives, users } from "@/db/schema";
import { and, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

/**
 * Public gallery — последние не-скрытые, не-удалённые, не-дизлайкнутые
 * креативы от не-забаненных юзеров. Сортировка: лайкнутые первыми,
 * потом по новизне.
 *
 * Возвращает только то что нужно для тайла галереи: id, format, cost,
 * htmlCode (для рендера preview), videoUrl (для анимации). Никаких
 * email'ов авторов — анонимно по умолчанию.
 */
export async function getPublicGallery(limit = 12) {
  const safeLimit = Math.min(Math.max(1, limit), 30);
  try {
    const rows = await db
      .select({
        id: creatives.id,
        format: creatives.format,
        cost: creatives.cost,
        htmlCode: creatives.htmlCode,
        videoUrl: creatives.videoUrl,
        prompt: creatives.prompt,
        feedbackScore: creatives.feedbackScore,
        createdAt: creatives.createdAt,
      })
      .from(creatives)
      .innerJoin(users, eq(users.id, creatives.userId))
      .where(
        and(
          eq(creatives.isPublic, true),
          isNull(creatives.deletedAt),
          // Drop dislikes from the gallery — we don't want to feature
          // creatives the author themselves marked as bad.
          or(
            isNull(creatives.feedbackScore),
            ne(creatives.feedbackScore, -1),
          ),
          // Hide banned authors
          or(eq(users.isBanned, false), isNull(users.isBanned)),
          // Must have something to render
          or(ne(creatives.htmlCode, ""), ne(creatives.videoUrl, "")),
        ),
      )
      // Liked first, then newest
      .orderBy(
        sql`(${creatives.feedbackScore} = 1) desc nulls last`,
        desc(creatives.createdAt),
      )
      .limit(safeLimit);

    return { success: true as const, items: rows };
  } catch (e: any) {
    console.error("getPublicGallery error", e);
    return { success: false as const, error: e?.message ?? "load failed" };
  }
}

/**
 * Toggle a creative's public visibility. Only the author can change
 * their own creative's flag.
 */
export async function toggleCreativePublic(
  creativeId: string,
  nextValue: boolean,
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false as const, error: "Не авторизован" };
    }
    const owner = await db
      .select({ id: creatives.id })
      .from(creatives)
      .where(and(eq(creatives.id, creativeId), eq(creatives.userId, userId)));
    if (owner.length === 0) {
      return { success: false as const, error: "Креатив не найден или не ваш" };
    }
    await db
      .update(creatives)
      .set({ isPublic: nextValue })
      .where(eq(creatives.id, creativeId));

    revalidatePath("/account");
    return { success: true as const, isPublic: nextValue };
  } catch (e: any) {
    console.error("toggleCreativePublic error", e);
    return { success: false as const, error: e?.message ?? "update failed" };
  }
}
