import Redis from 'ioredis';
import { config } from 'dotenv';

config();

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }

    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 100, 3000);
      },
      enableReadyCheck: true,
      lazyConnect: true,
      family: 4,
    });

    redisClient.on('error', (err: Error) => {
      console.error('[Redis] Connection error:', err.message);
    });

    redisClient.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });

    redisClient.on('ready', () => {
      console.log('[Redis] Ready to accept commands');
    });

    redisClient.on('close', () => {
      console.warn('[Redis] Connection closed');
    });

    redisClient.on('reconnecting', () => {
      console.log('[Redis] Reconnecting...');
    });
  }

  return redisClient;
}

export async function connectRedis(): Promise<void> {
  const client = getRedisClient();
  if (client.status === 'wait') {
    await client.connect();
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

export const REDIS_KEYS = {
  // Feed caches
  feed: (type: string, page: number) => `feed:${type}:page:${page}`,
  
  // Category feeds
  categoryFeed: (slug: string, page: number) => `feed:category:${slug}:page:${page}`,
  
  // Photo metadata
  photo: (photoId: string) => `photo:${photoId}`,
  photoLikes: (photoId: string) => `photo:${photoId}:likes`,
  photoLikedUsers: (photoId: string) => `photo:${photoId}:likedUsers`,
  photoViews: (photoId: string) => `photo:${photoId}:views`,
  photoDownloads: (photoId: string) => `photo:${photoId}:downloads`,
  photoShares: (photoId: string) => `photo:${photoId}:shares`,
  
  // User follows
  userFollowers: (userId: string) => `user:${userId}:followers`,
  userFollowing: (userId: string) => `user:${userId}:following`,
  
  // User profile
  userProfile: (userId: string) => `user:${userId}:profile`,
  userProfileByUsername: (username: string) => `user:username:${username}:profile`,
  
  // Cache TTLs (seconds)
  TTL: {
    FEED: 600,           // 10 minutes
    CATEGORY_FEED: 600,  // 10 minutes
    PHOTO: 300,          // 5 minutes
    PHOTO_COUNTS: 30,    // 30 seconds for like/view/download/share counts
    USER_PROFILE: 300,   // 5 minutes
    USER_FOLLOWS: 60,    // 1 minute
  },
};

export const QUEUE_NAMES = {
  LIKE: 'like-sync',
  FOLLOW: 'follow-sync',
  VIEW: 'view-sync',
  DOWNLOAD: 'download-sync',
  SHARE: 'share-sync',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];