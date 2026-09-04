import { Job } from 'bullmq';
import { db } from '@/db/db-connection';
import { photos, photoLikes } from '@/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { createWorker, QUEUE_NAMES } from '@/config/bull.config';
import { redisService } from '@/services/redis.service';

// In-memory tracking of latest processed timestamp per (photoId, userId)
// This ensures we process jobs in order and skip stale ones
const likeJobTimestamps = new Map<string, number>();

const likeWorker = createWorker<{ photoId: string; userId: string; action: 'like' | 'unlike'; timestamp: number }>(
  QUEUE_NAMES.LIKE,
  async (job: Job) => {
    const { photoId, userId, action, timestamp } = job.data;
    const dedupKey = `${photoId}:${userId}`;
    
    // Check if we have a newer job already processed for this (photoId, userId)
    const lastProcessedTimestamp = likeJobTimestamps.get(dedupKey) || 0;
    if (timestamp < lastProcessedTimestamp) {
      console.log(`[LikeWorker] Skipping stale job ${job.id} for ${dedupKey}: job timestamp ${timestamp} < last processed ${lastProcessedTimestamp}`);
      return; // Skip stale job
    }
    
    try {
      if (action === 'like') {
        // Check if already liked in DB
        const [existing] = await db
          .select()
          .from(photoLikes)
          .where(and(eq(photoLikes.photoId, photoId), eq(photoLikes.userId, userId)))
          .limit(1);

        if (!existing) {
          await db.transaction(async (tx) => {
            await tx.insert(photoLikes).values({ photoId, userId });
            await tx
              .update(photos)
              .set({ likesCount: sql`${photos.likesCount} + 1` })
              .where(eq(photos.id, photoId));
          });
        }
      } else if (action === 'unlike') {
        const [existing] = await db
          .select()
          .from(photoLikes)
          .where(and(eq(photoLikes.photoId, photoId), eq(photoLikes.userId, userId)))
          .limit(1);

        if (existing) {
          await db.transaction(async (tx) => {
            await tx.delete(photoLikes).where(and(eq(photoLikes.photoId, photoId), eq(photoLikes.userId, userId)));
            await tx
              .update(photos)
              .set({ likesCount: sql`${photos.likesCount} - 1` })
              .where(eq(photos.id, photoId));
          });
        }
      }
      
      // Update the last processed timestamp for this (photoId, userId)
      likeJobTimestamps.set(dedupKey, timestamp);
      
      // Verify sync by comparing Redis count with DB count
      const redisCount = await redisService.getLikeCount(photoId);
      const [dbPhoto] = await db.select({ likesCount: photos.likesCount }).from(photos).where(eq(photos.id, photoId)).limit(1);
      
      if (dbPhoto && redisCount !== dbPhoto.likesCount) {
        console.warn(`[LikeWorker] Count mismatch for photo ${photoId}: Redis=${redisCount}, DB=${dbPhoto.likesCount}`);
        // Reconcile: update DB to match Redis (Redis is source of truth for current state)
        await db
          .update(photos)
          .set({ likesCount: redisCount })
          .where(eq(photos.id, photoId));
      }
    } catch (error) {
      console.error(`[LikeWorker] Error processing job ${job.id}:`, error);
      throw error;
    }
  }
);

likeWorker.on('completed', (job) => {
  console.log(`[LikeWorker] Job ${job.id} completed`);
});

likeWorker.on('failed', (job, err) => {
  console.error(`[LikeWorker] Job ${job?.id} failed:`, err.message);
});

export { likeWorker };