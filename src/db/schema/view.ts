import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { photos } from './photo';

export const photoViews = pgTable('photo_views', {
  id: uuid('id').primaryKey().defaultRandom(),
  photoId: uuid('photo_id').notNull().references(() => photos.id, { onDelete: 'cascade' }),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  userAgent: text('user_agent'),
  viewedAt: timestamp('viewed_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  photoIdIdx: index('photo_views_photo_id_idx').on(table.photoId),
  viewedAtIdx: index('photo_views_viewed_at_idx').on(table.viewedAt),
}));

export const photoViewSelectSchema = createSelectSchema(photoViews);
export const photoViewInsertSchema = createInsertSchema(photoViews);

export type PhotoView = typeof photoViews.$inferSelect;
export type NewPhotoView = typeof photoViews.$inferInsert;