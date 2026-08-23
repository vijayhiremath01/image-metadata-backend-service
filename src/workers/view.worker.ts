import { Job } from 'bullmq';
import { db } from '@/db/db-connection';
import { photos, photoViews } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { createWorker, QUEUE_NAMES } from '@/config/bull.config';

const viewWorker = createWorker<{ photoId: string; ipAddress?: string; userAgent?: string }>(
  QUEUE_NAMES.VIEW,
  async (job: Job) => {
    const { photoId, ipAddress, userAgent } = job.data;
    
    try {
      // Record the view in photoViews table
      await db.insert(photoViews).values({ 
        photoId, 
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown'
      });

      // Increment views count in photos table
      await db
        .update(photos)
        .set({ viewsCount: sql`${photos.viewsCount} + 1` })
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