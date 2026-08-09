import { db } from "@/db/db-connection";
import { photos, photoLikes, photoViews, photoDownloads, photoCategories, categories, users } from "@/db/schema";
import { eq, desc, and, ilike, or, sql, count, inArray, exists } from "drizzle-orm";
import { imagekit } from "@/config/imagekit.config";

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
}) {
  const [photo] = await db
    .insert(photos)
    .values(data)
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
  const likeState = await addLikeStateToPhotos(photoIds, userId);

  const dataWithLikeState = data.map(photo => ({
    ...photo,
    liked: likeState.get(photo.id) ?? false,
  }));

  return {
    data: dataWithLikeState,
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
  if (userId) {
    const [like] = await db
      .select()
      .from(photoLikes)
      .where(and(eq(photoLikes.photoId, id), eq(photoLikes.userId, userId)))
      .limit(1);
    liked = !!like;
  }

  return {
    ...photo,
    liked,
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
  return {
    data: data.map(d => d.photo),
    total,
    page,
    limit,
    hasNext: page * limit < total,
  };
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
      .orderBy(desc(photos.likesCount), desc(photos.downloadsCount), desc(photos.viewsCount))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: count() })
      .from(photos)
      .where(eq(photos.isActive, true)),
  ]);

  const total = totalResult[0].count;
  const photoIds = data.map(p => p.id);
  const likeState = await addLikeStateToPhotos(photoIds, userId);

  const dataWithLikeState = data.map(photo => ({
    ...photo,
    liked: likeState.get(photo.id) ?? false,
  }));

  return {
    data: dataWithLikeState,
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
  const likeState = await addLikeStateToPhotos(photoIds, userId);

  const dataWithLikeState = data.map(photo => ({
    ...photo,
    liked: likeState.get(photo.id) ?? false,
  }));

  return {
    data: dataWithLikeState,
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
  const photoIds = data.map(p => p.id);
  const likeState = await addLikeStateToPhotos(photoIds, userId);

  const dataWithLikeState = data.map(photo => ({
    ...photo,
    liked: likeState.get(photo.id) ?? false,
  }));

  return {
    data: dataWithLikeState,
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
  const likeState = await addLikeStateToPhotos(photoIds, userId);

  const dataWithLikeState = photosData.map(photo => ({
    ...photo,
    liked: likeState.get(photo.id) ?? false,
  }));

  return {
    data: dataWithLikeState,
    total,
    page,
    limit,
    hasNext: page * limit < total,
  };
}