"use server";

import { db } from "@/db";
import { creatives, users } from "@/db/schema";
import { and, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin-guard";

export type TemplateScope = "all" | "mine" | "public";
export type GalleryItem = {
  id: string;
  format: string | null;
  cost: number | null;
  htmlCode: string | null;
  videoUrl: string | null;
  prompt: string | null;
  feedbackScore: number | null;
  isMine: boolean;
};

/**
 * Unified templates feed — user's own creatives + public ones from
 * other users in a single list, with optional scope filter. Used by
 * the editor's "Шаблоны" modal.
 *
 * Public set is filtered the same as `getPublicGallery`: published,
 * not deleted, not disliked, author not banned. User's own set
 * includes everything they haven't soft-deleted, regardless of
 * isPublic — it's their own bin.
 */
export async function getAllTemplates(scope: TemplateScope = "all", limit = 24) {
  const safeLimit = Math.min(Math.max(1, limit), 60);
  try {
    const { userId } = await auth();

    const items: GalleryItem[] = [];

    // 1) User's own (always included unless scope === "public")
    if (scope !== "public" && userId) {
      const mine = await db
        .select({
          id: creatives.id,
          format: creatives.format,
          cost: creatives.cost,
          htmlCode: creatives.htmlCode,
          videoUrl: creatives.videoUrl,
          prompt: creatives.prompt,
          feedbackScore: creatives.feedbackScore,
        })
        .from(creatives)
        .where(and(eq(creatives.userId, userId), isNull(creatives.deletedAt)))
        .orderBy(desc(creatives.createdAt))
        .limit(safeLimit);
      for (const m of mine) items.push({ ...m, isMine: true });
    }

    // 2) Public from other users
    if (scope !== "mine") {
      const pub = await db
        .select({
          id: creatives.id,
          format: creatives.format,
          cost: creatives.cost,
          htmlCode: creatives.htmlCode,
          videoUrl: creatives.videoUrl,
          prompt: creatives.prompt,
          feedbackScore: creatives.feedbackScore,
          authorId: creatives.userId,
        })
        .from(creatives)
        .innerJoin(users, eq(users.id, creatives.userId))
        .where(
          and(
            eq(creatives.isPublic, true),
            isNull(creatives.deletedAt),
            or(
              isNull(creatives.feedbackScore),
              ne(creatives.feedbackScore, -1),
            ),
            or(eq(users.isBanned, false), isNull(users.isBanned)),
            or(ne(creatives.htmlCode, ""), ne(creatives.videoUrl, "")),
            // Dual-model filter: показываем либо одиночные креативы
            // (legacy без pairId), либо победителей пар. Проигравших
            // (selectedAsBest=false) не показываем — они в публичной
            // галерее были бы шумом.
            or(isNull(creatives.pairId), eq(creatives.selectedAsBest, true)),
            // Exclude my own from the public bucket — they're already in
            // the "mine" set when scope === "all".
            userId ? ne(creatives.userId, userId) : sql`true`,
          ),
        )
        .orderBy(
          sql`(${creatives.feedbackScore} = 1) desc nulls last`,
          desc(creatives.createdAt),
        )
        .limit(safeLimit);
      for (const p of pub) {
        items.push({
          id: p.id,
          format: p.format,
          cost: p.cost,
          htmlCode: p.htmlCode,
          videoUrl: p.videoUrl,
          prompt: p.prompt,
          feedbackScore: p.feedbackScore,
          isMine: false,
        });
      }
    }

    const adminFlag = await isAdmin();
    return { success: true as const, items, isAdmin: adminFlag };
  } catch (e: any) {
    console.error("getAllTemplates error", e);
    return {
      success: false as const,
      error: e?.message ?? "load failed",
      items: [] as GalleryItem[],
      isAdmin: false,
    };
  }
}

/**
 * Admin-only: hide ANY creative from the public gallery (sets
 * is_public=false). Owner himself doesn't get a notification — we
 * just take it out of the public feed.
 */
export async function adminHideFromGallery(creativeId: string) {
  if (!(await isAdmin())) {
    return { success: false as const, error: "Access Denied" };
  }
  try {
    await db
      .update(creatives)
      .set({ isPublic: false })
      .where(eq(creatives.id, creativeId));
    revalidatePath("/editor");
    return { success: true as const };
  } catch (e: any) {
    console.error("adminHideFromGallery error", e);
    return { success: false as const, error: e?.message ?? "hide failed" };
  }
}

/**
 * Admin-only: soft-delete ANY creative. Sets deletedAt; row stays
 * in DB for the audit trail but disappears from gallery + author
 * history just like a normal user-delete.
 */
export async function adminDeleteFromGallery(creativeId: string) {
  if (!(await isAdmin())) {
    return { success: false as const, error: "Access Denied" };
  }
  try {
    await db
      .update(creatives)
      .set({ deletedAt: new Date() })
      .where(eq(creatives.id, creativeId));
    revalidatePath("/editor");
    return { success: true as const };
  } catch (e: any) {
    console.error("adminDeleteFromGallery error", e);
    return { success: false as const, error: e?.message ?? "delete failed" };
  }
}

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
          // Dual-model filter: legacy одиночные ИЛИ победитель пары.
          or(isNull(creatives.pairId), eq(creatives.selectedAsBest, true)),
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
