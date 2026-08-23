import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { getRedisClient } from './redis.config';
import { QUEUE_NAMES, QueueName } from './redis.config';
import { db } from '@/db/db-connection';
import { photos, userFollows, users } from '@/db/schema';
import { eq, sql, inArray } from 'drizzle-orm';

const redisClient = getRedisClient();

const queueOptions = {
  connection: redisClient,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
};

export const queues: Record<QueueName, Queue> = {
  [QUEUE_NAMES.LIKE]: new Queue(QUEUE_NAMES.LIKE, queueOptions),
  [QUEUE_NAMES.FOLLOW]: new Queue(QUEUE_NAMES.FOLLOW, queueOptions),
  [QUEUE_NAMES.VIEW]: new Queue(QUEUE_NAMES.VIEW, queueOptions),
  [QUEUE_NAMES.DOWNLOAD]: new Queue(QUEUE_NAMES.DOWNLOAD, queueOptions),
  [QUEUE_NAMES.SHARE]: new Queue(QUEUE_NAMES.SHARE, queueOptions),
};

export { QUEUE_NAMES };

export function getQueue(name: QueueName): Queue {
  return queues[name];
}

export async function addJob<T>(name: QueueName, data: T, opts?: { delay?: number }): Promise<void> {
  const queue = queues[name];
  await queue.add(name, data, { delay: opts?.delay || 0 });
}

export function createWorker<TPayload>(
  name: QueueName,
  processor: (job: Job<TPayload>) => Promise<void>
): Worker<TPayload> {
  const worker = new Worker<TPayload>(name, processor, {
    connection: redisClient,
    concurrency: 5,
  });

  worker.on('completed', (job) => {
    console.log(`[Worker:${name}] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker:${name}] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error(`[Worker:${name}] Worker error:`, err);
  });

  return worker;
}

export const queueEvents: Record<QueueName, QueueEvents> = {
  [QUEUE_NAMES.LIKE]: new QueueEvents(QUEUE_NAMES.LIKE, { connection: redisClient }),
  [QUEUE_NAMES.FOLLOW]: new QueueEvents(QUEUE_NAMES.FOLLOW, { connection: redisClient }),
  [QUEUE_NAMES.VIEW]: new QueueEvents(QUEUE_NAMES.VIEW, { connection: redisClient }),
  [QUEUE_NAMES.DOWNLOAD]: new QueueEvents(QUEUE_NAMES.DOWNLOAD, { connection: redisClient }),
  [QUEUE_NAMES.SHARE]: new QueueEvents(QUEUE_NAMES.SHARE, { connection: redisClient }),
};

export async function closeQueues(): Promise<void> {
  await Promise.all(Object.values(queues).map(q => q.close()));
  await Promise.all(Object.values(queueEvents).map(qe => qe.close()));
}