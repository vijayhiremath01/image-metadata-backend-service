import { db } from '@/db/db-connection';
import { notifications, users, photos } from '@/db/schema';
import { eq, and, count, desc, sql, inArray } from 'drizzle-orm';
import { NOTIFICATION_TYPES } from '@/db/schema/notification';

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}

export async function createNotification(data: {
  userId: string;
  actorId: string;
  type: string;
  photoId?: string;
}): Promise<typeof notifications.$inferSelect> {
  if (data.userId === data.actorId) {
    return null as any;
  }

  const [notification] = await db
    .insert(notifications)
    .values({
      userId: data.userId,
      actorId: data.actorId,
      type: data.type,
      photoId: data.photoId || null,
    })
    .returning();

  return notification;
}

export async function createLikeNotification(photoId: string, photoOwnerId: string, actorId: string): Promise<void> {
  await createNotification({
    userId: photoOwnerId,
    actorId,
    type: NOTIFICATION_TYPES.LIKE,
    photoId,
  });
}

export async function createFollowNotification(targetUserId: string, actorId: string): Promise<void> {
  await createNotification({
    userId: targetUserId,
    actorId,
    type: NOTIFICATION_TYPES.FOLLOW,
  });
}

export async function createCommentNotification(photoId: string, photoOwnerId: string, actorId: string): Promise<void> {
  await createNotification({
    userId: photoOwnerId,
    actorId,
    type: NOTIFICATION_TYPES.COMMENT,
    photoId,
  });
}

export async function createSaveNotification(photoId: string, photoOwnerId: string, actorId: string): Promise<void> {
  await createNotification({
    userId: photoOwnerId,
    actorId,
    type: NOTIFICATION_TYPES.SAVE,
    photoId,
  });
}

export async function getNotifications(userId: string, pagination: PaginationParams): Promise<PaginatedResult<typeof notifications.$inferSelect & { actor: { id: string; username: string; avatarUrl: string | null; displayName: string | null }; photo: { id: string; thumbnailUrl: string } | null }>> {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  const [data, totalResult] = await Promise.all([
    db
      .select({
        notification: notifications,
        actor: {
          id: users.id,
          username: users.username,
          avatarUrl: users.avatarUrl,
          displayName: users.displayName,
        },
        photo: {
          id: photos.id,
          thumbnailUrl: photos.thumbnailUrl,
        },
      })
      .from(notifications)
      .innerJoin(users, eq(notifications.actorId, users.id))
      .leftJoin(photos, eq(notifications.photoId, photos.id))
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(notifications)
      .where(eq(notifications.userId, userId)),
  ]);

  const total = totalResult[0].count;

  return {
    data: data.map(d => ({
      ...d.notification,
      actor: d.actor,
      photo: d.photo,
    })),
    total,
    page,
    limit,
    hasNext: page * limit < total,
  };
}

export async function markAsRead(notificationId: string, userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

export async function markAllAsRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
}

export async function getUnreadCount(userId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  return result.count;
}