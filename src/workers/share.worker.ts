import { Job } from 'bullmq';
import { db } from '@/db/db-connection';
import { photos } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { createWorker, QUEUE_NAMES } from '@/config/bull.config';
import { redisService } from '@/services/redis.service';

const shareWorker = createWorker<{ photoId: string; userId?: string; timestamp: number }>(
  QUEUE_NAMES.SHARE,
  async (job: Job) => {
    const { photoId, timestamp } = job.data;
    
    try {
      // Use atomic increment with reconciliation
      await redisService.incrementShares(photoId);
      
      // Update DB with the new count
      const redisCountAfter = await redisService.getShares(photoId);
      
      await db
        .update(photos)
        .set({ sharesCount: redisCountAfter })
        .where(eq(photos.id, photoId));
    } catch (error) {
      console.error(`[ShareWorker] Error processing job ${job.id}:`, error);
      throw error;
    }
  }
);

shareWorker.on('completed', (job) => {
  console.log(`[ShareWorker] Job ${job.id} completed`);
});

shareWorker.on('failed', (job, err) => {
  console.error(`[ShareWorker] Job ${job?.id} failed:`, err.message);
});

export { shareWorker };