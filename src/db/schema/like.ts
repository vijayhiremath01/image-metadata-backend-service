import { pgTable, uuid, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { photos } from './photo';
import { users } from './user';

export const photoLikes = pgTable('photo_likes', {
  id: uuid('id').primaryKey().defaultRandom(),
  photoId: uuid('photo_id').notNull().references(() => photos.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  photoIdIdx: index('photo_likes_photo_id_idx').on(table.photoId),
  userIdIdx: index('photo_likes_user_id_idx').on(table.userId),
  photoIdUserIdIdx: uniqueIndex('photo_likes_photo_id_user_id_idx').on(table.photoId, table.userId),
}));

export const photoLikeSelectSchema = createSelectSchema(photoLikes);
export const photoLikeInsertSchema = createInsertSchema(photoLikes);

export type PhotoLike = typeof photoLikes.$inferSelect;
export type NewPhotoLike = typeof photoLikes.$inferInsert;