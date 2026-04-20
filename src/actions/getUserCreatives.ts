"use server";

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { creatives } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

/**
 * Cap on how many creatives the editor's history modal ever pulls at once.
 * Each creative's `htmlCode` can embed several megabytes of base64 product
 * images, so unbounded SELECT * turns a 200-item history into a 200 MB
 * response and 14+ second server action. 50 is plenty for the UI (the
 * modal isn't infinite-scroll, it's a grid preview), and users with more
 * history can be served via pagination later if needed.
 */
const MAX_HISTORY_ITEMS = 50;

export async function getUserCreatives() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Pick only the columns the editor UI actually reads. Dropping
    // `feedbackText` and `apiCostKzt` and `imageUrl` shaves more weight off
    // every row; the big saver is still the LIMIT + the fact that htmlCode
    // is only loaded for at most MAX_HISTORY_ITEMS creatives.
    const userCreatives = await db
      .select({
        id: creatives.id,
        prompt: creatives.prompt,
        format: creatives.format,
        cost: creatives.cost,
        videoUrl: creatives.videoUrl,
        htmlCode: creatives.htmlCode,
        feedbackScore: creatives.feedbackScore,
        createdAt: creatives.createdAt,
      })
      .from(creatives)
      .where(eq(creatives.userId, userId))
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
