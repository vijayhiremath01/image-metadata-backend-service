import { pgTable, uuid, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { photos } from './photo';

export const photoAnalytics = pgTable('photo_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  photoId: uuid('photo_id').notNull().references(() => photos.id, { onDelete: 'cascade' }).unique(),
  impressions: integer('impressions').default(0).notNull(),
  views: integer('views').default(0).notNull(),
  downloads: integer('downloads').default(0).notNull(),
  shares: integer('shares').default(0).notNull(),
  saves: integer('saves').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  photoIdx: index('photo_analytics_photo_id_idx').on(table.photoId),
}));

export type PhotoAnalytics = typeof photoAnalytics.$inferSelect;
export type NewPhotoAnalytics = typeof photoAnalytics.$inferInsert;