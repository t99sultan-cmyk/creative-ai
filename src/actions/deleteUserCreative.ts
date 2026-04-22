"use server";

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { creatives } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

/**
 * SOFT delete — sets `deletedAt = NOW()` instead of dropping the row.
 *
 * Why: admins still need to see the full user history in the CRM,
 * including deleted items, for support and dispute resolution. The
 * user-facing editor filters these out (see getUserCreatives) so the
 * user experience is unchanged — it looks deleted from their side.
 *
 * Double-delete is a no-op (the `isNull(deletedAt)` guard makes the
 * UPDATE match zero rows on a second call).
 */
export async function deleteUserCreative(id: string) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    await db
      .update(creatives)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(creatives.id, id),
          eq(creatives.userId, userId),
          isNull(creatives.deletedAt),
        ),
      );

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting creative:', error);
    return { success: false, error: error.message };
  }
}
