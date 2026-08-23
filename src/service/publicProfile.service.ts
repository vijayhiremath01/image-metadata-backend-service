import { db } from '@/db/db-connection';
import { users, photos, photoLikes, boardPhotos, boards } from '@/db/schema';
import { eq, and, count, desc, sql, inArray } from 'drizzle-orm';
import { getFollowCounts, isFollowing } from './follow.service';
import { getMyPhotos } from './user.service';
import { redisService } from '@/services/redis.service';

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

export async function getPublicProfile(username: string, currentUserId?: string): Promise<{
  id: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  website: string | null;
  avatarUrl: string | null;
  followersCount: number;
  followingCount: number;
  photosCount: number;
  isFollowing: boolean;
  createdAt: Date;
} | null> {
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      bio: users.bio,
      website: users.website,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.username, username), eq(users.isActive, true)))
    .limit(1);

  if (!user) return null;

  const [followersCount, followingCount, photosCountResult, followingStatus] = await Promise.all([
    redisService.getFollowersCount(user.id),
    redisService.getFollowingCount(user.id),
    db.select({ count: count() }).from(photos).where(and(eq(photos.userId, user.id), eq(photos.isActive, true))),
    currentUserId ? redisService.isFollowing(currentUserId, user.id) : Promise.resolve(false),
  ]);

  return {
    ...user,
    followersCount,
    followingCount,
    photosCount: photosCountResult[0].count,
    isFollowing: followingStatus,
  };
}

export async function getUserPhotos(username: string, pagination: PaginationParams, currentUserId?: string): Promise<PaginatedResult<typeof photos.$inferSelect & { owner: { id: string; username: string; avatarUrl: string | null }; liked: boolean; saved: boolean }>> {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.username, username), eq(users.isActive, true)))
    .limit(1);

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  const [data, totalResult] = await Promise.all([
    db
      .select({
        photo: photos,
        owner: {
          id: users.id,
          username: users.username,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(photos)
      .innerJoin(users, eq(photos.userId, users.id))
      .where(and(eq(photos.userId, user.id), eq(photos.isActive, true)))
      .orderBy(desc(photos.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(photos)
      .where(and(eq(photos.userId, user.id), eq(photos.isActive, true))),
  ]);

  const total = totalResult[0].count;
  const photoIds = data.map(d => d.photo.id);

  let likedSet = new Set<string>();
  let savedSet = new Set<string>();

  if (currentUserId && photoIds.length > 0) {
    const [likes, saves] = await Promise.all([
      db
        .select({ photoId: photoLikes.photoId })
        .from(photoLikes)
        .where(and(eq(photoLikes.userId, currentUserId), inArray(photoLikes.photoId, photoIds))),
      db
        .select({ photoId: boardPhotos.photoId })
        .from(boardPhotos)
        .innerJoin(boards, eq(boardPhotos.boardId, boards.id))
        .where(and(eq(boards.userId, currentUserId), inArray(boardPhotos.photoId, photoIds))),
    ]);

    likedSet = new Set(likes.map(l => l.photoId));
    savedSet = new Set(saves.map(s => s.photoId));
  }

  const dataWithState = data.map(d => ({
    ...d.photo,
    owner: d.owner,
    liked: likedSet.has(d.photo.id),
    saved: savedSet.has(d.photo.id),
  }));

  return {
    data: dataWithState,
    total,
    page,
    limit,
    hasNext: page * limit < total,
  };
}