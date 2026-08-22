import { db } from '@/db/db-connection';
import { boards, boardPhotos, photos, users } from '@/db/schema';
import { eq, and, count, desc, sql, inArray } from 'drizzle-orm';

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

export async function createBoard(data: {
  userId: string;
  name: string;
  description?: string;
  isPrivate?: boolean;
}): Promise<typeof boards.$inferSelect> {
  if (data.name.length > 255) {
    throw new Error('BOARD_NAME_TOO_LONG');
  }

  const [board] = await db
    .insert(boards)
    .values({
      userId: data.userId,
      name: data.name,
      description: data.description || '',
      isPrivate: data.isPrivate ?? false,
    })
    .returning();

  return board;
}

export async function renameBoard(boardId: string, userId: string, name: string): Promise<typeof boards.$inferSelect> {
  if (name.length > 255) {
    throw new Error('BOARD_NAME_TOO_LONG');
  }

  const [board] = await db
    .select()
    .from(boards)
    .where(and(eq(boards.id, boardId), eq(boards.userId, userId)))
    .limit(1);

  if (!board) {
    throw new Error('BOARD_NOT_FOUND');
  }

  const [updated] = await db
    .update(boards)
    .set({ name, updatedAt: new Date() })
    .where(eq(boards.id, boardId))
    .returning();

  return updated;
}

export async function deleteBoard(boardId: string, userId: string): Promise<void> {
  const [board] = await db
    .select()
    .from(boards)
    .where(and(eq(boards.id, boardId), eq(boards.userId, userId)))
    .limit(1);

  if (!board) {
    throw new Error('BOARD_NOT_FOUND');
  }

  await db.delete(boards).where(eq(boards.id, boardId));
}

export async function savePhotoToBoard(boardId: string, photoId: string, userId: string): Promise<void> {
  const [board] = await db
    .select()
    .from(boards)
    .where(and(eq(boards.id, boardId), eq(boards.userId, userId)))
    .limit(1);

  if (!board) {
    throw new Error('BOARD_NOT_FOUND');
  }

  const [photo] = await db
    .select()
    .from(photos)
    .where(and(eq(photos.id, photoId), eq(photos.isActive, true)))
    .limit(1);

  if (!photo) {
    throw new Error('PHOTO_NOT_FOUND');
  }

  await db
    .insert(boardPhotos)
    .values({ boardId, photoId })
    .onConflictDoNothing();
}

export async function removePhotoFromBoard(boardId: string, photoId: string, userId: string): Promise<void> {
  const [board] = await db
    .select()
    .from(boards)
    .where(and(eq(boards.id, boardId), eq(boards.userId, userId)))
    .limit(1);

  if (!board) {
    throw new Error('BOARD_NOT_FOUND');
  }

  const [deleted] = await db
    .delete(boardPhotos)
    .where(and(eq(boardPhotos.boardId, boardId), eq(boardPhotos.photoId, photoId)))
    .returning({ id: boardPhotos.photoId });

  if (!deleted) {
    throw new Error('PHOTO_NOT_IN_BOARD');
  }
}

export async function getBoards(userId: string, pagination: PaginationParams, currentUserId?: string): Promise<PaginatedResult<typeof boards.$inferSelect & { photosCount: number; isOwner: boolean }>> {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  const isOwner = currentUserId === userId;

  const [data, totalResult] = await Promise.all([
    db
      .select({
        board: boards,
        photosCount: count(boardPhotos.photoId),
      })
      .from(boards)
      .leftJoin(boardPhotos, eq(boards.id, boardPhotos.boardId))
      .where(
        and(
          eq(boards.userId, userId),
          isOwner ? sql`true` : eq(boards.isPrivate, false)
        )
      )
      .groupBy(boards.id)
      .orderBy(desc(boards.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(boards)
      .where(
        and(
          eq(boards.userId, userId),
          isOwner ? sql`true` : eq(boards.isPrivate, false)
        )
      ),
  ]);

  const total = totalResult[0].count;

  return {
    data: data.map(d => ({
      ...d.board,
      photosCount: Number(d.photosCount),
      isOwner,
    })),
    total,
    page,
    limit,
    hasNext: page * limit < total,
  };
}

export async function getBoardById(boardId: string, currentUserId?: string): Promise<(typeof boards.$inferSelect & { photosCount: number; isOwner: boolean; user: { id: string; username: string; avatarUrl: string | null; displayName: string | null } }) | null> {
  const [board] = await db
    .select({
      board: boards,
      user: {
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
        displayName: users.displayName,
      },
      photosCount: count(boardPhotos.photoId),
    })
    .from(boards)
    .innerJoin(users, eq(boards.userId, users.id))
    .leftJoin(boardPhotos, eq(boards.id, boardPhotos.boardId))
    .where(eq(boards.id, boardId))
    .groupBy(boards.id, users.id)
    .limit(1);

  if (!board) return null;

  if (board.board.isPrivate && board.board.userId !== currentUserId) {
    return null;
  }

  return {
    ...board.board,
    photosCount: Number(board.photosCount),
    isOwner: board.board.userId === currentUserId,
    user: board.user,
  };
}

export async function getBoardPhotos(boardId: string, pagination: PaginationParams, currentUserId?: string): Promise<PaginatedResult<typeof photos.$inferSelect & { owner: { id: string; username: string; avatarUrl: string | null }; saved: boolean }>> {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  const board = await getBoardById(boardId, currentUserId);
  if (!board) {
    throw new Error('BOARD_NOT_FOUND');
  }

  const [data, totalResult] = await Promise.all([
    db
      .select({
        photo: photos,
        owner: {
          id: users.id,
          username: users.username,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(boardPhotos)
      .innerJoin(photos, eq(boardPhotos.photoId, photos.id))
      .innerJoin(users, eq(photos.userId, users.id))
      .where(and(eq(boardPhotos.boardId, boardId), eq(photos.isActive, true)))
      .orderBy(desc(boardPhotos.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(boardPhotos)
      .innerJoin(photos, eq(boardPhotos.photoId, photos.id))
      .where(and(eq(boardPhotos.boardId, boardId), eq(photos.isActive, true))),
  ]);

  const total = totalResult[0].count;
  const photoIds = data.map(d => d.photo.id);

  let savedSet = new Set<string>();
  if (currentUserId && photoIds.length > 0) {
    const saves = await db
      .select({ photoId: boardPhotos.photoId })
      .from(boardPhotos)
      .innerJoin(boards, eq(boardPhotos.boardId, boards.id))
      .where(and(eq(boards.userId, currentUserId), inArray(boardPhotos.photoId, photoIds)));
    savedSet = new Set(saves.map(s => s.photoId));
  }

  const dataWithSaved = data.map(d => ({
    ...d.photo,
    owner: d.owner,
    saved: savedSet.has(d.photo.id),
  }));

  return {
    data: dataWithSaved,
    total,
    page,
    limit,
    hasNext: page * limit < total,
  };
}

export async function getUserBoardsWithPhoto(userId: string, photoId: string): Promise<(typeof boards.$inferSelect & { isSaved: boolean })[]> {
  const userBoards = await db
    .select()
    .from(boards)
    .where(eq(boards.userId, userId));

  if (userBoards.length === 0) return [];

  const boardIds = userBoards.map(b => b.id);

  const savedPhotos = await db
    .select({ boardId: boardPhotos.boardId })
    .from(boardPhotos)
    .where(and(eq(boardPhotos.photoId, photoId), inArray(boardPhotos.boardId, boardIds)));

  const savedBoardIds = new Set(savedPhotos.map(s => s.boardId));

  return userBoards.map(board => ({
    ...board,
    isSaved: savedBoardIds.has(board.id),
  }));
}

export async function getSavedStatusBatch(photoIds: string[], userId: string): Promise<Map<string, boolean>> {
  const savedStatus = new Map<string, boolean>();
  
  if (photoIds.length === 0) return savedStatus;

  const saves = await db
    .select({ photoId: boardPhotos.photoId })
    .from(boardPhotos)
    .innerJoin(boards, eq(boardPhotos.boardId, boards.id))
    .where(and(eq(boards.userId, userId), inArray(boardPhotos.photoId, photoIds)));

  const savedSet = new Set(saves.map(s => s.photoId));
  photoIds.forEach(id => savedStatus.set(id, savedSet.has(id)));

  return savedStatus;
}