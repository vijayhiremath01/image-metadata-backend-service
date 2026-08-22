import { db } from '@/db/db-connection';
import { photoComments, users } from '@/db/schema';
import { eq, and, count, desc, sql } from 'drizzle-orm';

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

export async function createComment(data: {
  photoId: string;
  userId: string;
  text: string;
}): Promise<typeof photoComments.$inferSelect> {
  if (!data.text.trim()) {
    throw new Error('COMMENT_EMPTY');
  }
  if (data.text.length > 2000) {
    throw new Error('COMMENT_TOO_LONG');
  }

  const [comment] = await db
    .insert(photoComments)
    .values({
      photoId: data.photoId,
      userId: data.userId,
      text: data.text.trim(),
    })
    .returning();

  return comment;
}

export async function deleteComment(commentId: string, userId: string): Promise<void> {
  const [comment] = await db
    .select()
    .from(photoComments)
    .where(eq(photoComments.id, commentId))
    .limit(1);

  if (!comment) {
    throw new Error('COMMENT_NOT_FOUND');
  }

  if (comment.userId !== userId) {
    throw new Error('NOT_OWNER');
  }

  await db.delete(photoComments).where(eq(photoComments.id, commentId));
}

export async function getComments(photoId: string, pagination: PaginationParams): Promise<PaginatedResult<typeof photoComments.$inferSelect & { username: string; avatarUrl: string | null; displayName: string | null }>> {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  const [data, totalResult] = await Promise.all([
    db
      .select({
        comment: photoComments,
        username: users.username,
        avatarUrl: users.avatarUrl,
        displayName: users.displayName,
      })
      .from(photoComments)
      .innerJoin(users, eq(photoComments.userId, users.id))
      .where(eq(photoComments.photoId, photoId))
      .orderBy(desc(photoComments.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(photoComments)
      .where(eq(photoComments.photoId, photoId)),
  ]);

  const total = totalResult[0].count;

  return {
    data: data.map(d => ({
      ...d.comment,
      username: d.username,
      avatarUrl: d.avatarUrl,
      displayName: d.displayName,
    })),
    total,
    page,
    limit,
    hasNext: page * limit < total,
  };
}

export async function getCommentCount(photoId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(photoComments)
    .where(eq(photoComments.photoId, photoId));
  return result.count;
}