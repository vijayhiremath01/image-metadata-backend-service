import { db } from '@/db/db-connection';
import { users, photos, sessions, photoLikes, photoViews, photoDownloads, photoCategories, photoTags } from '@/db/schema';
import { eq, count, desc, and, sql } from 'drizzle-orm';
import { imagekit } from '@/config/imagekit.config';

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}

export async function getUserProfile(userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.isActive, true)))
    .limit(1);

  if (!user) {
    return null;
  }

  const [photosCountResult] = await db
    .select({ count: count() })
    .from(photos)
    .where(and(eq(photos.userId, userId), eq(photos.isActive, true)));

  const [likesReceivedResult] = await db
    .select({ count: count() })
    .from(photoLikes)
    .innerJoin(photos, eq(photoLikes.photoId, photos.id))
    .where(eq(photos.userId, userId));

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatarUrl: user.avatarUrl,
    photosCount: photosCountResult.count,
    likesReceived: likesReceivedResult.count,
    createdAt: user.createdAt,
  };
}

export async function getMyPhotos(userId: string, pagination: PaginationParams): Promise<PaginatedResult<typeof photos.$inferSelect>> {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  const [data, totalResult] = await Promise.all([
    db
      .select()
      .from(photos)
      .where(and(eq(photos.userId, userId), eq(photos.isActive, true)))
      .orderBy(desc(photos.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(photos)
      .where(and(eq(photos.userId, userId), eq(photos.isActive, true))),
  ]);

  const total = totalResult[0].count;
  return {
    data,
    total,
    page,
    limit,
    hasNext: page * limit < total,
  };
}

export async function deleteAccount(userId: string): Promise<void> {
  const userPhotos = await db
    .select()
    .from(photos)
    .where(eq(photos.userId, userId));

  for (const photo of userPhotos) {
    if (photo.imagekitFileId) {
      try {
        await imagekit.deleteFile(photo.imagekitFileId);
      } catch (error) {
        console.error(`Failed to delete ImageKit file ${photo.imagekitFileId}:`, error);
      }
    }
  }

  await db.transaction(async (tx) => {
    const photoIds = userPhotos.map(p => p.id);

    if (photoIds.length > 0) {
      await tx.delete(photoLikes).where(sql`${photoLikes.photoId} IN (${photoIds.join(',')})`);
      await tx.delete(photoViews).where(sql`${photoViews.photoId} IN (${photoIds.join(',')})`);
      await tx.delete(photoDownloads).where(sql`${photoDownloads.photoId} IN (${photoIds.join(',')})`);
      await tx.delete(photoCategories).where(sql`${photoCategories.photoId} IN (${photoIds.join(',')})`);
      await tx.delete(photoTags).where(sql`${photoTags.photoId} IN (${photoIds.join(',')})`);
      await tx.delete(photos).where(sql`${photos.id} IN (${photoIds.join(',')})`);
    }

    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.delete(users).where(eq(users.id, userId));
  });
}