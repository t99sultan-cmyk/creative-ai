"use server";

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { creatives } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function getUserCreatives() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: 'Unauthorized' };
    }

    const userCreatives = await db
      .select()
      .from(creatives)
      .where(eq(creatives.userId, userId))
      .orderBy(desc(creatives.createdAt));

    return { 
      success: true, 
      creatives: userCreatives
    };
  } catch (error: any) {
    console.error('Error fetching creatives:', error);
    return { success: false, error: error.message };
  }
}
