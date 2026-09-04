import { Job } from 'bullmq';
import { db } from '@/db/db-connection';
import { photos, photoDownloads } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { createWorker, QUEUE_NAMES } from '@/config/bull.config';
import { redisService } from '@/services/redis.service';

const downloadWorker = createWorker<{ photoId: string; ipAddress?: string; userAgent?: string; timestamp: number }>(
  QUEUE_NAMES.DOWNLOAD,
  async (job: Job) => {
    const { photoId, ipAddress, userAgent, timestamp } = job.data;
    
    try {
      // Record the download in photoDownloads table
      await db.insert(photoDownloads).values({ 
        photoId, 
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown'
      });

      // Use atomic increment with reconciliation
      await redisService.incrementDownloads(photoId);
      
      // Update DB with the new count
      const redisCountAfter = await redisService.getDownloads(photoId);
      
      await db
        .update(photos)
        .set({ downloadsCount: redisCountAfter })
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