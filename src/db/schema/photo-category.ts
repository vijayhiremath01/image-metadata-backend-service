import { pgTable, uuid, timestamp, primaryKey, index } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { photos } from './photo';
import { categories } from './category';

export const photoCategories = pgTable('photo_categories', {
  photoId: uuid('photo_id').notNull().references(() => photos.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.photoId, table.categoryId] }),
  categoryIdIdx: index('photo_categories_category_id_idx').on(table.categoryId),
}));

export const photoCategorySelectSchema = createSelectSchema(photoCategories);
export const photoCategoryInsertSchema = createInsertSchema(photoCategories);

export type PhotoCategory = typeof photoCategories.$inferSelect;
export type NewPhotoCategory = typeof photoCategories.$inferInsert;