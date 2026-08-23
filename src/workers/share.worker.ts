import { Job } from 'bullmq';
import { db } from '@/db/db-connection';
import { photos } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { createWorker, QUEUE_NAMES } from '@/config/bull.config';

const shareWorker = createWorker<{ photoId: string; userId?: string }>(
  QUEUE_NAMES.SHARE,
  async (job: Job) => {
    const { photoId } = job.data;
    
    try {
      // Increment shares count in photos table
      await db
        .update(photos)
        .set({ sharesCount: sql`${photos.sharesCount} + 1` })
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