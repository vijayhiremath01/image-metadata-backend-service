import { pgTable, uuid, varchar, text, integer, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { users } from './user';

export const photos = pgTable('photos', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  originalUrl: varchar('original_url', { length: 500 }).notNull(),
  displayUrl: varchar('display_url', { length: 500 }).notNull(),
  thumbnailUrl: varchar('thumbnail_url', { length: 500 }).notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  blurHash: varchar('blur_hash', { length: 100 }),
  hexColor: varchar('hex_color', { length: 7 }),
  sizeBytes: integer('size_bytes').notNull(),
  fileFormat: varchar('file_format', { length: 20 }).notNull(),
  cameraMake: varchar('camera_make', { length: 100 }),
  cameraModel: varchar('camera_model', { length: 100 }),
  viewsCount: integer('views_count').default(0).notNull(),
  downloadsCount: integer('downloads_count').default(0).notNull(),
  likesCount: integer('likes_count').default(0).notNull(),
  sharesCount: integer('shares_count').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  imagekitFileId: varchar('imagekit_file_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  createdAtIdx: index('photos_created_at_idx').on(table.createdAt),
  viewsCountIdx: index('photos_views_count_idx').on(table.viewsCount),
  downloadsCountIdx: index('photos_downloads_count_idx').on(table.downloadsCount),
  likesCountIdx: index('photos_likes_count_idx').on(table.likesCount),
  sharesCountIdx: index('photos_shares_count_idx').on(table.sharesCount),
  isActiveIdx: index('photos_is_active_idx').on(table.isActive),
  userIdIdx: index('photos_user_id_idx').on(table.userId),
}));

export const photoSelectSchema = createSelectSchema(photos);
export const photoInsertSchema = createInsertSchema(photos);

export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;