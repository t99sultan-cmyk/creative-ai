"use server";

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { creatives } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export async function deleteUserCreative(id: string) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Ensure they only delete their own creative
    await db
      .delete(creatives)
      .where(
        and(
          eq(creatives.id, id),
          eq(creatives.userId, userId)
        )
      );

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting creative:', error);
    return { success: false, error: error.message };
  }
}
