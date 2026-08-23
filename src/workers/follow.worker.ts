import { Job } from 'bullmq';
import { db } from '@/db/db-connection';
import { userFollows, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createWorker, QUEUE_NAMES } from '@/config/bull.config';
import { redisService } from '@/services/redis.service';

const followWorker = createWorker<{ followerId: string; followingId: string; action: 'follow' | 'unfollow' }>(
  QUEUE_NAMES.FOLLOW,
  async (job: Job) => {
    const { followerId, followingId, action } = job.data;
    
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