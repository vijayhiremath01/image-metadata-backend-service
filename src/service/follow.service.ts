import { db } from '@/db/db-connection';
import { userFollows, users } from '@/db/schema';
import { eq, and, count, inArray, sql } from 'drizzle-orm';
import { redisService } from '@/services/redis.service';
import { getQueue, QUEUE_NAMES } from '@/config/bull.config';

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

export async function followUser(followerId: string, followingId: string): Promise<void> {
  if (followerId === followingId) {
    throw new Error('CANNOT_FOLLOW_SELF');
  }

  const [targetUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, followingId))
    .limit(1);

  if (!targetUser) {
    throw new Error('USER_NOT_FOUND');
  }

  // Use Redis for instant response
  await redisService.followUser(followerId, followingId);

  // Queue for DB sync
  await getQueue(QUEUE_NAMES.FOLLOW).add('follow', { followerId, followingId, action: 'follow' });
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  // Use Redis for instant response
  await redisService.unfollowUser(followerId, followingId);

  // Queue for DB sync
  await getQueue(QUEUE_NAMES.FOLLOW).add('follow', { followerId, followingId, action: 'unfollow' });
}

export async function getFollowers(userId: string, pagination: PaginationParams, currentUserId?: string): Promise<PaginatedResult<{ id: string; username: string; avatarUrl: string | null; displayName: string | null; isFollowing: boolean }>> {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  const [data, totalResult] = await Promise.all([
    db
      .select({
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
        displayName: users.displayName,
      })
      .from(userFollows)
      .innerJoin(users, eq(userFollows.followerId, users.id))
      .where(eq(userFollows.followingId, userId))
      .orderBy(sql`${userFollows.createdAt} DESC`)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(userFollows)
      .where(eq(userFollows.followingId, userId)),
  ]);

  const total = totalResult[0].count;
  const followerIds = data.map(u => u.id);

  let followingSet = new Set<string>();
  if (currentUserId && followerIds.length > 0) {
    const follows = await db
      .select({ followingId: userFollows.followingId })
      .from(userFollows)
      .where(and(eq(userFollows.followerId, currentUserId), inArray(userFollows.followingId, followerIds)));
    followingSet = new Set(follows.map(f => f.followingId));
  }

  const dataWithFollowState = data.map(user => ({
    ...user,
    isFollowing: followingSet.has(user.id),
  }));

  return {
    data: dataWithFollowState,
    total,
    page,
    limit,
    hasNext: page * limit < total,
  };
}

export async function getFollowing(userId: string, pagination: PaginationParams, currentUserId?: string): Promise<PaginatedResult<{ id: string; username: string; avatarUrl: string | null; displayName: string | null; isFollowing: boolean }>> {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  const [data, totalResult] = await Promise.all([
    db
      .select({
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
        displayName: users.displayName,
      })
      .from(userFollows)
      .innerJoin(users, eq(userFollows.followingId, users.id))
      .where(eq(userFollows.followerId, userId))
      .orderBy(sql`${userFollows.createdAt} DESC`)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(userFollows)
      .where(eq(userFollows.followerId, userId)),
  ]);

  const total = totalResult[0].count;
  const followingIds = data.map(u => u.id);

  let followingSet = new Set<string>();
  if (currentUserId && followingIds.length > 0) {
    const follows = await db
      .select({ followingId: userFollows.followingId })
      .from(userFollows)
      .where(and(eq(userFollows.followerId, currentUserId), inArray(userFollows.followingId, followingIds)));
    followingSet = new Set(follows.map(f => f.followingId));
  }

  const dataWithFollowState = data.map(user => ({
    ...user,
    isFollowing: followingSet.has(user.id),
  }));

  return {
    data: dataWithFollowState,
    total,
    page,
    limit,
    hasNext: page * limit < total,
  };
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const [follow] = await db
    .select()
    .from(userFollows)
    .where(and(eq(userFollows.followerId, followerId), eq(userFollows.followingId, followingId)))
    .limit(1);
  return !!follow;
}

export async function getFollowCounts(userId: string): Promise<{ followersCount: number; followingCount: number }> {
  const [followersResult, followingResult] = await Promise.all([
    db.select({ count: count() }).from(userFollows).where(eq(userFollows.followingId, userId)),
    db.select({ count: count() }).from(userFollows).where(eq(userFollows.followerId, userId)),
  ]);

  return {
    followersCount: followersResult[0].count,
    followingCount: followingResult[0].count,
  };
}

export async function getFollowStatusBatch(userIds: string[], currentUserId: string): Promise<Map<string, boolean>> {
  const followStatus = new Map<string, boolean>();
  
  if (userIds.length === 0) return followStatus;

  const follows = await db
    .select({ followingId: userFollows.followingId })
    .from(userFollows)
    .where(and(eq(userFollows.followerId, currentUserId), inArray(userFollows.followingId, userIds)));

  const followingSet = new Set(follows.map(f => f.followingId));
  userIds.forEach(id => followStatus.set(id, followingSet.has(id)));

  return followStatus;
}