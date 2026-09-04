import { getRedisClient } from '@/config/redis.config';
import { REDIS_KEYS, REDIS_KEYS as KEYS } from '@/config/redis.config';
import { getQueue } from '@/config/bull.config';
import { QUEUE_NAMES } from '@/config/redis.config';

const redis = getRedisClient();

export class RedisService {
  // ==================== FEED CACHING ====================

  async getFeed(type: 'foryou' | 'trending' | 'latest', page: number): Promise<any | null> {
    const key = KEYS.feed(type, page);
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async setFeed(type: 'foryou' | 'trending' | 'latest', page: number, data: any): Promise<void> {
    const key = KEYS.feed(type, page);
    await redis.setex(key, KEYS.TTL.FEED, JSON.stringify(data));
  }

  async getCategoryFeed(slug: string, page: number): Promise<any | null> {
    const key = KEYS.categoryFeed(slug, page);
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async setCategoryFeed(slug: string, page: number, data: any): Promise<void> {
    const key = KEYS.categoryFeed(slug, page);
    await redis.setex(key, KEYS.TTL.CATEGORY_FEED, JSON.stringify(data));
  }

  async invalidateFeedCaches(): Promise<void> {
    const keys = await redis.keys('feed:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  async invalidateCategoryFeed(slug?: string): Promise<void> {
    if (slug) {
      const keys = await redis.keys(`feed:category:${slug}:*`);
      if (keys.length > 0) await redis.del(...keys);
    } else {
      const keys = await redis.keys('feed:category:*');
      if (keys.length > 0) await redis.del(...keys);
    }
  }

  // ==================== PHOTO METADATA ====================

  async getPhoto(photoId: string): Promise<any | null> {
    const key = KEYS.photo(photoId);
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async setPhoto(photoId: string, data: any): Promise<void> {
    const key = KEYS.photo(photoId);
    await redis.setex(key, KEYS.TTL.PHOTO, JSON.stringify(data));
  }

  async invalidatePhoto(photoId: string): Promise<void> {
    const keys = [
      KEYS.photo(photoId),
      KEYS.photoLikes(photoId),
      KEYS.photoLikedUsers(photoId),
      KEYS.photoViews(photoId),
      KEYS.photoDownloads(photoId),
      KEYS.photoShares(photoId),
    ];
    await redis.del(...keys);
  }

  // ==================== LIKES ====================

  async getLikeCount(photoId: string): Promise<number> {
    const key = KEYS.photoLikes(photoId);
    const count = await redis.get(key);
    return count ? parseInt(count, 10) : 0;
  }

  async getLikedUsers(photoId: string): Promise<Set<string>> {
    const key = KEYS.photoLikedUsers(photoId);
    const members = await redis.smembers(key);
    return new Set(members);
  }

  async hasUserLiked(photoId: string, userId: string): Promise<boolean> {
    const key = KEYS.photoLikedUsers(photoId);
    return (await redis.sismember(key, userId)) === 1;
  }

  async likePhoto(photoId: string, userId: string): Promise<{ likesCount: number; liked: boolean }> {
    const likesKey = KEYS.photoLikes(photoId);
    const usersKey = KEYS.photoLikedUsers(photoId);

    const isLiked = await redis.sismember(usersKey, userId);
    if (isLiked) {
      return { likesCount: await this.getLikeCount(photoId), liked: true };
    }

    const pipeline = redis.pipeline();
    pipeline.sadd(usersKey, userId);
    pipeline.incr(likesKey);
    const results = await pipeline.exec();

    const likesCount = results?.[1]?.[1] as number || 1;

    // Queue for DB sync with timestamp for ordering
    await getQueue(QUEUE_NAMES.LIKE).add('like', { 
      photoId, 
      userId, 
      action: 'like',
      timestamp: Date.now()
    });

    return { likesCount, liked: true };
  }

  async unlikePhoto(photoId: string, userId: string): Promise<{ likesCount: number; liked: boolean }> {
    const likesKey = KEYS.photoLikes(photoId);
    const usersKey = KEYS.photoLikedUsers(photoId);

    const isLiked = await redis.sismember(usersKey, userId);
    if (!isLiked) {
      return { likesCount: await this.getLikeCount(photoId), liked: false };
    }

    const pipeline = redis.pipeline();
    pipeline.srem(usersKey, userId);
    pipeline.decr(likesKey);
    const results = await pipeline.exec();

    const likesCount = Math.max(0, (results?.[1]?.[1] as number) || 0);

    // Queue for DB sync with timestamp for ordering
    await getQueue(QUEUE_NAMES.LIKE).add('like', { 
      photoId, 
      userId, 
      action: 'unlike',
      timestamp: Date.now()
    });

    return { likesCount, liked: false };
  }

  // ==================== FOLLOWS ====================

  async followUser(followerId: string, followingId: string): Promise<void> {
    if (followerId === followingId) return;

    const followerKey = KEYS.userFollowing(followerId);
    const followingKey = KEYS.userFollowers(followingId);

    const isFollowing = await redis.sismember(followerKey, followingId);
    if (isFollowing) return;

    const pipeline = redis.pipeline();
    pipeline.sadd(followerKey, followingId);
    pipeline.sadd(followingKey, followerId);
    await pipeline.exec();

    await getQueue(QUEUE_NAMES.FOLLOW).add('follow', { 
      followerId, 
      followingId, 
      action: 'follow',
      timestamp: Date.now()
    });
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    const followerKey = KEYS.userFollowing(followerId);
    const followingKey = KEYS.userFollowers(followingId);

    const isFollowing = await redis.sismember(followerKey, followingId);
    if (!isFollowing) return;

    const pipeline = redis.pipeline();
    pipeline.srem(followerKey, followingId);
    pipeline.srem(followingKey, followerId);
    await pipeline.exec();

    await getQueue(QUEUE_NAMES.FOLLOW).add('follow', { 
      followerId, 
      followingId, 
      action: 'unfollow',
      timestamp: Date.now()
    });
  }

  async getFollowersCount(userId: string): Promise<number> {
    const key = KEYS.userFollowers(userId);
    return redis.scard(key);
  }

  async getFollowingCount(userId: string): Promise<number> {
    const key = KEYS.userFollowing(userId);
    return redis.scard(key);
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const key = KEYS.userFollowing(followerId);
    return (await redis.sismember(key, followingId)) === 1;
  }

  async getFollowers(userId: string, page: number, limit: number): Promise<string[]> {
    const key = KEYS.userFollowers(userId);
    const start = (page - 1) * limit;
    const end = start + limit - 1;
    return redis.zrange(key, start, end);
  }

  async getFollowing(userId: string, page: number, limit: number): Promise<string[]> {
    const key = KEYS.userFollowing(userId);
    const start = (page - 1) * limit;
    const end = start + limit - 1;
    return redis.zrange(key, start, end);
  }

  // ==================== COUNTERS (Views, Downloads, Shares) ====================

  async incrementViews(photoId: string): Promise<number> {
    const key = KEYS.photoViews(photoId);
    const count = await redis.incr(key);
    await redis.expire(key, 86400); // 24h TTL for view counts
    await getQueue(QUEUE_NAMES.VIEW).add('view', { photoId });
    return count;
  }

  async incrementDownloads(photoId: string): Promise<number> {
    const key = KEYS.photoDownloads(photoId);
    const count = await redis.incr(key);
    await redis.expire(key, 86400);
    await getQueue(QUEUE_NAMES.DOWNLOAD).add('download', { photoId });
    return count;
  }

  async incrementShares(photoId: string): Promise<number> {
    const key = KEYS.photoShares(photoId);
    const count = await redis.incr(key);
    await redis.expire(key, 86400);
    await getQueue(QUEUE_NAMES.SHARE).add('share', { photoId });
    return count;
  }

  async getViews(photoId: string): Promise<number> {
    const key = KEYS.photoViews(photoId);
    const count = await redis.get(key);
    return count ? parseInt(count, 10) : 0;
  }

  async getDownloads(photoId: string): Promise<number> {
    const key = KEYS.photoDownloads(photoId);
    const count = await redis.get(key);
    return count ? parseInt(count, 10) : 0;
  }

  async getShares(photoId: string): Promise<number> {
    const key = KEYS.photoShares(photoId);
    const count = await redis.get(key);
    return count ? parseInt(count, 10) : 0;
  }

  // ==================== USER PROFILE ====================

  async getUserProfile(userId: string): Promise<any | null> {
    const key = KEYS.userProfile(userId);
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async getUserProfileByUsername(username: string): Promise<any | null> {
    const key = KEYS.userProfileByUsername(username);
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async setUserProfile(userId: string, data: any): Promise<void> {
    const key = KEYS.userProfile(userId);
    await redis.setex(key, KEYS.TTL.USER_PROFILE, JSON.stringify(data));
  }

  async setUserProfileByUsername(username: string, data: any): Promise<void> {
    const key = KEYS.userProfileByUsername(username);
    await redis.setex(key, KEYS.TTL.USER_PROFILE, JSON.stringify(data));
  }

  async invalidateUserProfile(userId: string): Promise<void> {
    await redis.del(KEYS.userProfile(userId));
  }

  async invalidateUserProfileByUsername(username: string): Promise<void> {
    await redis.del(KEYS.userProfileByUsername(username));
  }

  // ==================== UTILITY ====================

  async healthCheck(): Promise<boolean> {
    try {
      const result = await redis.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}

export const redisService = new RedisService();