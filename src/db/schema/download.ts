import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { photos } from './photo';

export const photoDownloads = pgTable('photo_downloads', {
  id: uuid('id').primaryKey().defaultRandom(),
  photoId: uuid('photo_id').notNull().references(() => photos.id, { onDelete: 'cascade' }),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  userAgent: text('user_agent'),
  downloadedAt: timestamp('downloaded_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  photoIdIdx: index('photo_downloads_photo_id_idx').on(table.photoId),
  downloadedAtIdx: index('photo_downloads_downloaded_at_idx').on(table.downloadedAt),
}));

export const photoDownloadSelectSchema = createSelectSchema(photoDownloads);
export const photoDownloadInsertSchema = createInsertSchema(photoDownloads);

export type PhotoDownload = typeof photoDownloads.$inferSelect;
export type NewPhotoDownload = typeof photoDownloads.$inferInsert;