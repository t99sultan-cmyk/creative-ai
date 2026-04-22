"use server";

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { creatives } from '@/db/schema';
import { and, eq, desc, inArray, isNull } from 'drizzle-orm';

/**
 * Cap on how many creatives the editor's history modal ever pulls at once.
 * Each creative's `htmlCode` can embed several megabytes of base64 product
 * images, so unbounded SELECT * turns a 200-item history into a 200 MB
 * response and 14+ second server action. 50 is plenty for the UI (the
 * modal isn't infinite-scroll, it's a grid preview), and users with more
 * history can be served via pagination later if needed.
 */
const MAX_HISTORY_ITEMS = 50;

/**
 * Lightweight history fetch — METADATA ONLY, no htmlCode.
 *
 * htmlCode is what makes a creative row heavy (embedded base64 product
 * images push each row to 1-8 MB). The editor's initial load doesn't
 * actually need htmlCode — it just renders a list/preview. htmlCode is
 * loaded lazily via `getCreativeHtml(id)` when the user opens the
 * history modal or clicks an individual creative.
 *
 * With this split: initial load is ~30 KB for 50 rows (fractions of a
 * second) instead of the previous 50-200 MB (14+ seconds).
 */
export async function getUserCreatives() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Soft-delete aware: users never see creatives they've deleted.
    // (Admin panel still sees them via getUserHistory.)
    const userCreatives = await db
      .select({
        id: creatives.id,
        prompt: creatives.prompt,
        format: creatives.format,
        cost: creatives.cost,
        videoUrl: creatives.videoUrl,
        feedbackScore: creatives.feedbackScore,
        createdAt: creatives.createdAt,
      })
      .from(creatives)
      .where(and(eq(creatives.userId, userId), isNull(creatives.deletedAt)))
      .orderBy(desc(creatives.createdAt))
      .limit(MAX_HISTORY_ITEMS);

    return {
      success: true,
      creatives: userCreatives,
    };
  } catch (error: any) {
    console.error('Error fetching creatives:', error);
    return { success: false, error: error.message };
  }
}

/**
 * On-demand htmlCode fetch for one or more creatives.
 *
 * Called when the history modal opens (to render iframe previews) or
 * when a user clicks an individual creative for remix. Ownership is
 * enforced — a user can only read their OWN htmlCode.
 *
 * Returns a map: { [creativeId]: htmlCode }.
 * Missing / foreign IDs are silently omitted (don't leak existence).
 */
export async function getCreativeHtml(ids: string[]) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Input shape guard — no bloating the query with 10k IDs.
    const clean = Array.isArray(ids)
      ? ids.filter((x) => typeof x === 'string' && x.length > 0).slice(0, 50)
      : [];
    if (clean.length === 0) {
      return { success: true, htmlMap: {} as Record<string, string> };
    }

    const rows = await db
      .select({
        id: creatives.id,
        htmlCode: creatives.htmlCode,
      })
      .from(creatives)
      .where(
        and(
          eq(creatives.userId, userId),
          inArray(creatives.id, clean),
          isNull(creatives.deletedAt),
        ),
      );

    const htmlMap: Record<string, string> = {};
    for (const r of rows) {
      if (r.htmlCode) htmlMap[r.id] = r.htmlCode;
    }

    return { success: true, htmlMap };
  } catch (error: any) {
    console.error('Error fetching creative html:', error);
    return { success: false, error: error.message };
  }
}
