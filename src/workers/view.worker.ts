import { Job } from 'bullmq';
import { db } from '@/db/db-connection';
import { photos, photoViews } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { createWorker, QUEUE_NAMES } from '@/config/bull.config';
import { redisService } from '@/services/redis.service';

const viewWorker = createWorker<{ photoId: string; ipAddress?: string; userAgent?: string; timestamp: number }>(
  QUEUE_NAMES.VIEW,
  async (job: Job) => {
    const { photoId, ipAddress, userAgent, timestamp } = job.data;
    
    try {
      // Record the view in photoViews table
      await db.insert(photoViews).values({ 
        photoId, 
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown'
      });

      // Use atomic increment with reconciliation
      // Get current Redis count before incrementing
      const redisCountBefore = await redisService.getViews(photoId);
      
      // Increment in Redis and DB atomically
      await redisService.incrementViews(photoId);
      
      // Update DB with the new count
      const redisCountAfter = await redisService.getViews(photoId);
      
      await db
        .update(photos)
        .set({ viewsCount: redisCountAfter })
        .where(eq(photos.id, photoId));
    } catch (error) {
      console.error(`[ViewWorker] Error processing job ${job.id}:`, error);
      throw error;
    }
  }
);

viewWorker.on('completed', (job) => {
  console.log(`[ViewWorker] Job ${job.id} completed`);
});

viewWorker.on('failed', (job, err) => {
  console.error(`[ViewWorker] Job ${job?.id} failed:`, err.message);
});

export { viewWorker };