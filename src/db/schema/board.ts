import { pgTable, uuid, varchar, text, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './user';
import { photos } from './photo';

export const boards = pgTable('boards', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  isPrivate: boolean('is_private').default(false).notNull(),
  coverPhotoId: uuid('cover_photo_id').references(() => photos.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('boards_user_id_idx').on(table.userId),
  coverPhotoIdx: index('boards_cover_photo_id_idx').on(table.coverPhotoId),
}));

export const boardPhotos = pgTable('board_photos', {
  boardId: uuid('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  photoId: uuid('photo_id').notNull().references(() => photos.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: uniqueIndex('board_photos_unique').on(table.boardId, table.photoId),
  boardIdx: index('board_photos_board_id_idx').on(table.boardId),
  photoIdx: index('board_photos_photo_id_idx').on(table.photoId),
}));

export type Board = typeof boards.$inferSelect;
export type NewBoard = typeof boards.$inferInsert;
export type BoardPhoto = typeof boardPhotos.$inferSelect;
export type NewBoardPhoto = typeof boardPhotos.$inferInsert;