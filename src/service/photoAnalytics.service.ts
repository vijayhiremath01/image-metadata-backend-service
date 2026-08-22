import { db } from '@/db/db-connection';
import { photoAnalytics, photos } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export type AnalyticsEventType = 'impression' | 'view' | 'download' | 'share' | 'save';

export async function recordEvent(photoId: string, eventType: AnalyticsEventType): Promise<void> {
  const columnMap: Record<AnalyticsEventType, keyof typeof photoAnalytics.$inferInsert> = {
    impression: 'impressions',
    view: 'views',
    download: 'downloads',
    share: 'shares',
    save: 'saves',
  };

  const column = columnMap[eventType];
  if (!column) return;

  await db
    .insert(photoAnalytics)
    .values({ photoId, [column]: 1 })
    .onConflictDoUpdate({
      target: photoAnalytics.photoId,
      set: { [column]: sql`${photoAnalytics[column]} + 1`, updatedAt: new Date() },
    });
}

export async function recordImpression(photoId: string): Promise<void> {
  await recordEvent(photoId, 'impression');
}

export async function recordView(photoId: string): Promise<void> {
  await recordEvent(photoId, 'view');
}

export async function recordDownload(photoId: string): Promise<void> {
  await recordEvent(photoId, 'download');
}

export async function recordShare(photoId: string): Promise<void> {
  await recordEvent(photoId, 'share');
}

export async function recordSave(photoId: string): Promise<void> {
  await recordEvent(photoId, 'save');
}

export async function getAnalytics(photoId: string): Promise<typeof photoAnalytics.$inferSelect | null> {
  const [analytics] = await db
    .select()
    .from(photoAnalytics)
    .where(eq(photoAnalytics.photoId, photoId))
    .limit(1);
  return analytics || null;
}

export async function getBatchAnalytics(photoIds: string[]): Promise<Map<string, typeof photoAnalytics.$inferSelect>> {
  const analyticsMap = new Map<string, typeof photoAnalytics.$inferSelect>();
  
  if (photoIds.length === 0) return analyticsMap;

  const results = await db
    .select()
    .from(photoAnalytics)
    .where(sql`${photoAnalytics.photoId} IN (${photoIds.join(',')})`);

  results.forEach(a => analyticsMap.set(a.photoId, a));
  return analyticsMap;
}

export async function getTrendingWithAnalytics(limit = 20): Promise<(typeof photos.$inferSelect & { analytics: typeof photoAnalytics.$inferSelect })[]> {
  const results = await db
    .select({
      photo: photos,
      analytics: photoAnalytics,
    })
    .from(photos)
    .leftJoin(photoAnalytics, eq(photos.id, photoAnalytics.photoId))
    .where(eq(photos.isActive, true))
    .orderBy(
      sql`(
        COALESCE(${photos.likesCount}, 0) * 4 +
        COALESCE(${photoAnalytics.downloads}, 0) * 3 +
        COALESCE(${photoAnalytics.shares}, 0) * 5 +
        COALESCE(${photoAnalytics.views}, 0) * 0.1 +
        COALESCE(${photoAnalytics.saves}, 0) * 2
      ) / (EXTRACT(EPOCH FROM (NOW() - ${photos.createdAt})) / 3600 + 2) ^ 1.5`
    )
    .limit(limit);

  return results.map(r => ({
    ...r.photo,
    analytics: r.analytics || { impressions: 0, views: 0, downloads: 0, shares: 0, saves: 0 } as typeof photoAnalytics.$inferSelect,
  }));
}