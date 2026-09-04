import { Job } from 'bullmq';
import { db } from '@/db/db-connection';
import { userFollows, users } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { createWorker, QUEUE_NAMES } from '@/config/bull.config';
import { redisService } from '@/services/redis.service';

// In-memory tracking of latest processed timestamp per (followerId, followingId)
const followJobTimestamps = new Map<string, number>();

const followWorker = createWorker<{ followerId: string; followingId: string; action: 'follow' | 'unfollow'; timestamp: number }>(
  QUEUE_NAMES.FOLLOW,
  async (job: Job) => {
    const { followerId, followingId, action, timestamp } = job.data;
    const dedupKey = `${followerId}:${followingId}`;
    
    // Check if we have a newer job already processed for this (followerId, followingId)
    const lastProcessedTimestamp = followJobTimestamps.get(dedupKey) || 0;
    if (timestamp < lastProcessedTimestamp) {
      console.log(`[FollowWorker] Skipping stale job ${job.id} for ${dedupKey}: job timestamp ${timestamp} < last processed ${lastProcessedTimestamp}`);
      return; // Skip stale job
    }
    
    try {
      if (action === 'follow') {
        const [existing] = await db
          .select()
          .from(userFollows)
          .where(and(eq(userFollows.followerId, followerId), eq(userFollows.followingId, followingId)))
          .limit(1);

        if (!existing) {
          await db.transaction(async (tx) => {
            await tx.insert(userFollows).values({ followerId, followingId });
          });
        }
      } else if (action === 'unfollow') {
        await db
          .delete(userFollows)
          .where(and(eq(userFollows.followerId, followerId), eq(userFollows.followingId, followingId)));
      }
      
      // Update the last processed timestamp for this (followerId, followingId)
      followJobTimestamps.set(dedupKey, timestamp);
      
      // Verify sync by comparing Redis counts with DB
      const redisFollowersCount = await redisService.getFollowersCount(followingId);
      const redisFollowingCount = await redisService.getFollowingCount(followerId);
      
      const [dbFollowers] = await db
        .select({ count: sql`count(*)` })
        .from(userFollows)
        .where(eq(userFollows.followingId, followingId));
      
      const [dbFollowing] = await db
        .select({ count: sql`count(*)` })
        .from(userFollows)
        .where(eq(userFollows.followerId, followerId));
      
      if (dbFollowers && Number(dbFollowers.count) !== redisFollowersCount) {
        console.warn(`[FollowWorker] Followers count mismatch for user ${followingId}: Redis=${redisFollowersCount}, DB=${dbFollowers.count}`);
      }
      
      if (dbFollowing && Number(dbFollowing.count) !== redisFollowingCount) {
        console.warn(`[FollowWorker] Following count mismatch for user ${followerId}: Redis=${redisFollowingCount}, DB=${dbFollowing.count}`);
      }
    } catch (error) {
      console.error(`[FollowWorker] Error processing job ${job.id}:`, error);
      throw error;
    }
  }
);

followWorker.on('completed', (job) => {
  console.log(`[FollowWorker] Job ${job.id} completed`);
});

followWorker.on('failed', (job, err) => {
  console.error(`[FollowWorker] Job ${job?.id} failed:`, err.message);
});

export { followWorker };