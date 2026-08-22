import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './user';
import { photos } from './photo';

export const photoComments = pgTable('photo_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  photoId: uuid('photo_id').notNull().references(() => photos.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  photoIdx: index('photo_comments_photo_id_idx').on(table.photoId),
  userIdx: index('photo_comments_user_id_idx').on(table.userId),
}));

export type PhotoComment = typeof photoComments.$inferSelect;
export type NewPhotoComment = typeof photoComments.$inferInsert;