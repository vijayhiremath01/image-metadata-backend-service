import { db } from '@/db/db-connection';
import { userInterests, users } from '@/db/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';

export async function updateInterestScore(userId: string, topic: string, delta: number): Promise<void> {
  const [existing] = await db
    .select()
    .from(userInterests)
    .where(and(eq(userInterests.userId, userId), eq(userInterests.topic, topic)))
    .limit(1);

  const newScore = Math.max(0, (existing?.score ?? 0) + delta);

  if (existing) {
    await db
      .update(userInterests)
      .set({ score: newScore, updatedAt: new Date() })
      .where(eq(userInterests.id, existing.id));
  } else if (delta > 0) {
    await db
      .insert(userInterests)
      .values({ userId, topic, score: newScore });
  }
}

export async function getUserInterests(userId: string, limit = 20): Promise<{ topic: string; score: number }[]> {
  return db
    .select({ topic: userInterests.topic, score: userInterests.score })
    .from(userInterests)
    .where(eq(userInterests.userId, userId))
    .orderBy(desc(userInterests.score))
    .limit(limit);
}

export async function recordLikeInterest(userId: string, categorySlug: string): Promise<void> {
  await updateInterestScore(userId, `category:${categorySlug}`, 2);
}

export async function recordUploadInterest(userId: string, categorySlug: string): Promise<void> {
  await updateInterestScore(userId, `category:${categorySlug}`, 5);
}

export async function recordSaveInterest(userId: string, categorySlug: string): Promise<void> {
  await updateInterestScore(userId, `category:${categorySlug}`, 3);
}

export async function recordCategoryViewInterest(userId: string, categorySlug: string): Promise<void> {
  await updateInterestScore(userId, `category:${categorySlug}`, 1);
}

export async function getTopInterests(userId: string, limit = 10): Promise<string[]> {
  const interests = await getUserInterests(userId, limit);
  return interests.map(i => i.topic);
}