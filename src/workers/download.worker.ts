import { Job } from 'bullmq';
import { db } from '@/db/db-connection';
import { photos, photoDownloads } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { createWorker, QUEUE_NAMES } from '@/config/bull.config';

const downloadWorker = createWorker<{ photoId: string; ipAddress?: string; userAgent?: string }>(
  QUEUE_NAMES.DOWNLOAD,
  async (job: Job) => {
    const { photoId, ipAddress, userAgent } = job.data;
    
    try {
      // Record the download in photoDownloads table
      await db.insert(photoDownloads).values({ 
        photoId, 
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown'
      });

      // Increment downloads count in photos table
      await db
        .update(photos)
        .set({ downloadsCount: sql`${photos.downloadsCount} + 1` })
        .where(eq(photos.id, photoId));
    } catch (error) {
      console.error(`[DownloadWorker] Error processing job ${job.id}:`, error);
      throw error;
    }
  }
);

downloadWorker.on('completed', (job) => {
  console.log(`[DownloadWorker] Job ${job.id} completed`);
});

downloadWorker.on('failed', (job, err) => {
  console.error(`[DownloadWorker] Job ${job?.id} failed:`, err.message);
});

export { downloadWorker };