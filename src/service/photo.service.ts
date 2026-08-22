import { db } from "@/db/db-connection";
import { photos, photoLikes, photoViews, photoDownloads, photoCategories, categories, users, boardPhotos, boards } from "@/db/schema";
import { eq, desc, and, ilike, or, sql, count, inArray, exists } from "drizzle-orm";
import { imagekit } from "@/config/imagekit.config";
import { recordImpression, recordView, recordDownload, recordShare, recordSave } from './photoAnalytics.service';
import { updateInterestScore } from './userInterest.service';
import { createLikeNotification, createSaveNotification } from './notification.service';

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

export type PhotoWithLikeState = typeof photos.$inferSelect & {
  liked?: boolean;
  saved?: boolean;
  owner?: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
};

export async function createPhoto(data: {
  userId: string;
  title: string;
  description?: string;
  originalUrl: string;
  displayUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
  fileFormat: string;
  imagekitFileId: string;
  blurHash?: string;
  hexColor?: string;
  cameraMake?: string;
  cameraModel?: string;
}) {
  const [photo] = await db
    .insert(photos)
    .values({
      ...data,
      blurHash: data.blurHash || null,
      hexColor: data.hexColor || null,
      cameraMake: data.cameraMake || null,
      cameraModel: data.cameraModel || null,
    })
    .returning();

  return photo;
}

async function addLikeStateToPhotos(photoIds: string[], userId: string | undefined): Promise<Map<string, boolean>> {
  const likeState = new Map<string, boolean>();
  
  if (!userId || photoIds.length === 0) {
    photoIds.forEach(id => likeState.set(id, false));
    return likeState;
  }

  const likes = await db
    .select({ photoId: photoLikes.photoId })
    .from(photoLikes)
    .where(and(
      eq(photoLikes.userId, userId),
      inArray(photoLikes.photoId, photoIds)
    ));

  const likedPhotoIds = new Set(likes.map(l => l.photoId));
  photoIds.forEach(id => likeState.set(id, likedPhotoIds.has(id)));

  return likeState;
}

async function addSavedStateToPhotos(photoIds: string[], userId: string | undefined): Promise<Map<string, boolean>> {
  const savedState = new Map<string, boolean>();
  
  if (!userId || photoIds.length === 0) {
    photoIds.forEach(id => savedState.set(id, false));
    return savedState;
  }

  const saves = await db
    .select({ photoId: boardPhotos.photoId })
    .from(boardPhotos)
    .innerJoin(boards, eq(boardPhotos.boardId, boards.id))
    .where(and(eq(boards.userId, userId), inArray(boardPhotos.photoId, photoIds)));

  const savedPhotoIds = new Set(saves.map(s => s.photoId));
  photoIds.forEach(id => savedState.set(id, savedPhotoIds.has(id)));

  return savedState;
}

export async function getAllPhotos(pagination: PaginationParams): Promise<PaginatedResult<typeof photos.$inferSelect>> {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  const [data, totalResult] = await Promise.all([
    db
      .select()
      .from(photos)
      .where(eq(photos.isActive, true))
      .orderBy(desc(photos.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(photos)
      .where(eq(photos.isActive, true)),
  ]);

  const total = totalResult[0].count;
  return {
    data,
    total,
    page,
    limit,
    hasNext: page * limit < total,
  };
}

export async function getAllPhotosWithLikeState(
  pagination: PaginationParams, 
  userId?: string
): Promise<PaginatedResult<PhotoWithLikeState>> {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  const [data, totalResult] = await Promise.all([
    db
      .select()
      .from(photos)
      .where(eq(photos.isActive, true))
      .orderBy(desc(photos.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(photos)
      .where(eq(photos.isActive, true)),
  ]);

  const total = totalResult[0].count;
  const photoIds = data.map(p => p.id);
  
  const [likeState, savedState] = await Promise.all([
    addLikeStateToPhotos(photoIds, userId),
    addSavedStateToPhotos(photoIds, userId),
  ]);

  const dataWithState = data.map(photo => ({
    ...photo,
    liked: likeState.get(photo.id) ?? false,
    saved: savedState.get(photo.id) ?? false,
  }));

  return {
    data: dataWithState,
    total,
    page,
    limit,
    hasNext: page * limit < total,
  };
}

export async function getPhotoById(id: string) {
  const [photo] = await db
    .select()
    .from(photos)
    .where(and(eq(photos.id, id), eq(photos.isActive, true)))
    .limit(1);

  return photo;
}

export async function getPhotoByIdWithOwner(id: string) {
  const [photo] = await db
    .select({
      photo: photos,
      owner: {
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(photos)
    .innerJoin(users, eq(photos.userId, users.id))
    .where(and(eq(photos.id, id), eq(photos.isActive, true)))
    .limit(1);

  return photo;
}

export async function getPhotoByIdWithOwnerAndLikeState(
  id: string, 
  userId?: string
) {
  const [photo] = await db
    .select({
      photo: photos,
      owner: {
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(photos)
    .innerJoin(users, eq(photos.userId, users.id))
    .where(and(eq(photos.id, id), eq(photos.isActive, true)))
    .limit(1);

  if (!photo) {
    return null;
  }

  let liked = false;
  let saved = false;
  if (userId) {
    const [like, save] = await Promise.all([
      db
        .select()
        .from(photoLikes)
        .where(and(eq(photoLikes.photoId, id), eq(photoLikes.userId, userId)))
        .limit(1),
      db
        .select()
        .from(boardPhotos)
        .innerJoin(boards, eq(boardPhotos.boardId, boards.id))
        .where(and(eq(boardPhotos.photoId, id), eq(boards.userId, userId)))
        .limit(1),
    ]);
    liked = !!like;
    saved = !!save;
  }

  return {
    ...photo,
    liked,
    saved,
  };
}

export async function likePhoto(photoId: string, userId: string): Promise<{ likesCount: number; liked: boolean }> {
  const photo = await getPhotoById(photoId);
  if (!photo) {
    throw new Error("PHOTO_NOT_FOUND");
  }

  const [existingLike] = await db
    .select()
    .from(photoLikes)
    .where(and(eq(photoLikes.photoId, photoId), eq(photoLikes.userId, userId)))
    .limit(1);

  if (existingLike) {
    throw new Error("ALREADY_LIKED");
  }

  await db.transaction(async (tx) => {
    await tx.insert(photoLikes).values({ photoId, userId });
    await tx
      .update(photos)
      .set({ likesCount: sql`${photos.likesCount} + 1` })
      .where(eq(photos.id, photoId));
  });

  const [updated] = await db
    .select({ likesCount: photos.likesCount })
    .from(photos)
    .where(eq(photos.id, photoId))
    .limit(1);

  if (photo.userId !== userId) {
    await createLikeNotification(photoId, photo.userId, userId);
  }

  await updateInterestScore(userId, `category:${photo.id}`, 2);

  return { likesCount: updated.likesCount, liked: true };
}

export async function unlikePhoto(photoId: string, userId: string): Promise<{ likesCount: number; liked: boolean }> {
  const photo = await getPhotoById(photoId);
  if (!photo) {
    throw new Error("PHOTO_NOT_FOUND");
  }

  const [existingLike] = await db
    .select()
    .from(photoLikes)
    .where(and(eq(photoLikes.photoId, photoId), eq(photoLikes.userId, userId)))
    .limit(1);

  if (!existingLike) {
    throw new Error("NOT_LIKED");
  }

  await db.transaction(async (tx) => {
    await tx.delete(photoLikes).where(and(eq(photoLikes.photoId, photoId), eq(photoLikes.userId, userId)));
    await tx
      .update(photos)
      .set({ likesCount: sql`${photos.likesCount} - 1` })
      .where(eq(photos.id, photoId));
  });

  const [updated] = await db
    .select({ likesCount: photos.likesCount })
    .from(photos)
    .where(eq(photos.id, photoId))
    .limit(1);

  const newCount = Math.max(0, updated.likesCount);
  if (newCount !== updated.likesCount) {
    await db.update(photos).set({ likesCount: 0 }).where(eq(photos.id, photoId));
  }

  return { likesCount: newCount, liked: false };
}

export async function sharePhoto(photoId: string, userId: string): Promise<{ sharesCount: number }> {
  const photo = await getPhotoById(photoId);
  if (!photo) {
    throw new Error("PHOTO_NOT_FOUND");
  }

  await db
    .update(photos)
    .set({ sharesCount: sql`${photos.sharesCount} + 1` })
    .where(eq(photos.id, photoId));

  const [updated] = await db
    .select({ sharesCount: photos.sharesCount })
    .from(photos)
    .where(eq(photos.id, photoId))
    .limit(1);

  await recordShare(photoId);

  return { sharesCount: updated.sharesCount };
}

export async function viewPhoto(photoId: string, ipAddress: string, userAgent: string | undefined): Promise<void> {
  const photo = await getPhotoById(photoId);
  if (!photo) {
    throw new Error("PHOTO_NOT_FOUND");
  }

  await db.transaction(async (tx) => {
    await tx.insert(photoViews).values({ photoId, ipAddress, userAgent });
    await tx
      .update(photos)
      .set({ viewsCount: sql`${photos.viewsCount} + 1` })
      .where(eq(photos.id, photoId));
  });

  await recordView(photoId);
}

export async function downloadPhoto(photoId: string, ipAddress: string, userAgent: string | undefined): Promise<string> {
  const photo = await getPhotoById(photoId);
  if (!photo) {
    throw new Error("PHOTO_NOT_FOUND");
  }

  await db.transaction(async (tx) => {
    await tx.insert(photoDownloads).values({ photoId, ipAddress, userAgent });
    await tx
      .update(photos)
      .set({ downloadsCount: sql`${photos.downloadsCount} + 1` })
      .where(eq(photos.id, photoId));
  });

  await recordDownload(photoId);

  return photo.originalUrl;
}

export async function getTrendingPhotos(pagination: PaginationParams): Promise<PaginatedResult<typeof photos.$inferSelect>> {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  const [data, totalResult] = await Promise.all([
    db
      .select()
      .from(photos)
      .where(eq(photos.isActive, true))
      .orderBy(desc(photos.likesCount), desc(photos.downloadsCount), desc(photos.viewsCount))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(photos)
      .where(eq(photos.isActive, true)),
  ]);

  const total = totalResult[0].count;
  return {
    data,
    total,
    page,
    limit,
    hasNext: page * limit < total,
  };
}

export async function getLatestPhotos(pagination: PaginationParams): Promise<PaginatedResult<typeof photos.$inferSelect>> {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  const [data, totalResult] = await Promise.all([
    db
      .select()
      .from(photos)
      .where(eq(photos.isActive, true))
      .orderBy(desc(photos.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(photos)
      .where(eq(photos.isActive, true)),
  ]);

  const total = totalResult[0].count;
  return {
    data,
    total,
    page,
    limit,
    hasNext: page * limit < total,
  };
}

export async function searchPhotos(query: string, pagination: PaginationParams): Promise<PaginatedResult<typeof photos.$inferSelect>> {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;
  const searchTerm = `%${query}%`;

  const [data, totalResult] = await Promise.all([
    db
      .select()
      .from(photos)
      .where(and(eq(photos.isActive, true), or(ilike(photos.title, searchTerm), ilike(photos.description, searchTerm))))
      .orderBy(desc(photos.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(photos)
      .where(and(eq(photos.isActive, true), or(ilike(photos.title, searchTerm), ilike(photos.description, searchTerm)))),
  ]);

  const total = totalResult[0].count;
  return {
    data,
    total,
    page,
    limit,
    hasNext: page * limit < total,
  };
}

export async function deletePhoto(id: string, userId: string): Promise<void> {
  const photo = await getPhotoById(id);
  if (!photo) {
    throw new Error("PHOTO_NOT_FOUND");
  }

  if (photo.userId !== userId) {
    throw new Error("NOT_OWNER");
  }

  if (photo.imagekitFileId) {
    try {
      await imagekit.deleteFile(photo.imagekitFileId);
    } catch (error) {
      console.error(`Failed to delete ImageKit file ${photo.imagekitFileId}:`, error);
    }
  }

  await db.delete(photos).where(eq(photos.id, id));
}

export async function getPhotosByCategorySlug(slug: string, pagination: PaginationParams): Promise<PaginatedResult<typeof photos.$inferSelect>> {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.slug, slug), eq(categories.isActive, true)))
    .limit(1);

  if (!category) {
    throw new Error("CATEGORY_NOT_FOUND");
  }

  const [data, totalResult] = await Promise.all([
    db
      .select({ photo: photos })
      .from(photos)
      .innerJoin(photoCategories, eq(photos.id, photoCategories.photoId))
      .where(and(eq(photoCategories.categoryId, category.id), eq(photos.isActive, true)))
      .orderBy(desc(photos.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(photos)
      .innerJoin(photoCategories, eq(photos.id, photoCategories.photoId))
      .where(and(eq(photoCategories.categoryId, category.id), eq(photos.isActive, true))),
  ]);

  const total = totalResult[0].count;
  const photosData = data.map(d => d.photo);

  return {
    data: photosData,
    total,
    page,
    limit,
    hasNext: page * limit < total,
  };
}

export async function savePhotoToBoard(photoId: string, boardId: string, userId: string): Promise<void> {
  const photo = await getPhotoById(photoId);
  if (!photo) {
    throw new Error("PHOTO_NOT_FOUND");
  }

  const [board] = await db
    .select()
    .from(boards)
    .where(and(eq(boards.id, boardId), eq(boards.userId, userId)))
    .limit(1);

  if (!board) {
    throw new Error("BOARD_NOT_FOUND");
  }

  await db
    .insert(boardPhotos)
    .values({ boardId, photoId })
    .onConflictDoNothing();

  await recordSave(photoId);

  if (photo.userId !== userId) {
    await createSaveNotification(photoId, photo.userId, userId);
  }
}

export async function unsavePhotoFromBoard(photoId: string, boardId: string, userId: string): Promise<void> {
  const [board] = await db
    .select()
    .from(boards)
    .where(and(eq(boards.id, boardId), eq(boards.userId, userId)))
    .limit(1);

  if (!board) {
    throw new Error("BOARD_NOT_FOUND");
  }

  const [deleted] = await db
    .delete(boardPhotos)
    .where(and(eq(boardPhotos.boardId, boardId), eq(boardPhotos.photoId, photoId)))
    .returning({ id: boardPhotos.photoId });

  if (!deleted) {
    throw new Error("PHOTO_NOT_IN_BOARD");
  }
}

export async function getTrendingPhotosWithLikeState(
  pagination: PaginationParams, 
  userId?: string
): Promise<PaginatedResult<PhotoWithLikeState>> {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  const [data, totalResult] = await Promise.all([
    db
      .select()
      .from(photos)
      .where(eq(photos.isActive, true))
      .orderBy(
        sql`(
          (${photos.likesCount} * 4) + 
          (${photos.downloadsCount} * 3) + 
          (${photos.sharesCount} * 5) + 
          (${photos.viewsCount} * 0.1)
        ) / POWER(EXTRACT(EPOCH FROM (NOW() - ${photos.createdAt})) / 3600 + 2, 1.5)`
      )
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(photos)
      .where(eq(photos.isActive, true)),
  ]);

  const total = totalResult[0].count;
  const photoIds = data.map(p => p.id);
  
  const [likeState, savedState] = await Promise.all([
    addLikeStateToPhotos(photoIds, userId),
    addSavedStateToPhotos(photoIds, userId),
  ]);

  const dataWithState = data.map(photo => ({
    ...photo,
    liked: likeState.get(photo.id) ?? false,
    saved: savedState.get(photo.id) ?? false,
  }));

  return {
    data: dataWithState,
    total,
    page,
    limit,
    hasNext: page * limit < total,
  };
}

export async function getLatestPhotosWithLikeState(
  pagination: PaginationParams, 
  userId?: string
): Promise<PaginatedResult<PhotoWithLikeState>> {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  const [data, totalResult] = await Promise.all([
    db
      .select()
      .from(photos)
      .where(eq(photos.isActive, true))
      .orderBy(desc(photos.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(photos)
      .where(eq(photos.isActive, true)),
  ]);

  const total = totalResult[0].count;
  const photoIds = data.map(p => p.id);
  
  const [likeState, savedState] = await Promise.all([
    addLikeStateToPhotos(photoIds, userId),
    addSavedStateToPhotos(photoIds, userId),
  ]);

  const dataWithState = data.map(photo => ({
    ...photo,
    liked: likeState.get(photo.id) ?? false,
    saved: savedState.get(photo.id) ?? false,
  }));

  return {
    data: dataWithState,
    total,
    page,
    limit,
    hasNext: page * limit < total,
  };
}

export async function searchPhotosWithLikeState(
  query: string, 
  pagination: PaginationParams, 
  userId?: string
): Promise<PaginatedResult<PhotoWithLikeState>> {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;
  const searchTerm = `%${query}%`;

  const [data, totalResult] = await Promise.all([
    db
      .select()
      .from(photos)
      .innerJoin(users, eq(photos.userId, users.id))
      .leftJoin(photoCategories, eq(photos.id, photoCategories.photoId))
      .leftJoin(categories, eq(photoCategories.categoryId, categories.id))
      .where(and(
        eq(photos.isActive, true),
        or(
          ilike(photos.title, searchTerm),
          ilike(photos.description, searchTerm),
          ilike(users.username, searchTerm),
          ilike(categories.name, searchTerm)
        )
      ))
      .orderBy(desc(photos.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(photos)
      .innerJoin(users, eq(photos.userId, users.id))
      .leftJoin(photoCategories, eq(photos.id, photoCategories.photoId))
      .leftJoin(categories, eq(photoCategories.categoryId, categories.id))
      .where(and(
        eq(photos.isActive, true),
        or(
          ilike(photos.title, searchTerm),
          ilike(photos.description, searchTerm),
          ilike(users.username, searchTerm),
          ilike(categories.name, searchTerm)
        )
      )),
  ]);

  const total = totalResult[0].count;
  const photoIds = data.map(p => p.photos.id);
  
  const [likeState, savedState] = await Promise.all([
    addLikeStateToPhotos(photoIds, userId),
    addSavedStateToPhotos(photoIds, userId),
  ]);

  const dataWithState = data.map(d => ({
    ...d.photos,
    liked: likeState.get(d.photos.id) ?? false,
    saved: savedState.get(d.photos.id) ?? false,
  }));

  return {
    data: dataWithState,
    total,
    page,
    limit,
    hasNext: page * limit < total,
  };
}

export async function getPhotosByCategorySlugWithLikeState(
  slug: string, 
  pagination: PaginationParams, 
  userId?: string
): Promise<PaginatedResult<PhotoWithLikeState>> {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.slug, slug), eq(categories.isActive, true)))
    .limit(1);

  if (!category) {
    throw new Error("CATEGORY_NOT_FOUND");
  }

  const [data, totalResult] = await Promise.all([
    db
      .select({ photo: photos })
      .from(photos)
      .innerJoin(photoCategories, eq(photos.id, photoCategories.photoId))
      .where(and(eq(photoCategories.categoryId, category.id), eq(photos.isActive, true)))
      .orderBy(desc(photos.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(photos)
      .innerJoin(photoCategories, eq(photos.id, photoCategories.photoId))
      .where(and(eq(photoCategories.categoryId, category.id), eq(photos.isActive, true))),
  ]);

  const total = totalResult[0].count;
  const photosData = data.map(d => d.photo);
  const photoIds = photosData.map(p => p.id);
  
  const [likeState, savedState] = await Promise.all([
    addLikeStateToPhotos(photoIds, userId),
    addSavedStateToPhotos(photoIds, userId),
  ]);

  const dataWithState = photosData.map(photo => ({
    ...photo,
    liked: likeState.get(photo.id) ?? false,
    saved: savedState.get(photo.id) ?? false,
  }));

  return {
    data: dataWithState,
    total,
    page,
    limit,
    hasNext: page * limit < total,
  };
}