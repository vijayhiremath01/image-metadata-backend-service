import { pgTable, uuid, primaryKey, index } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { photos } from './photo';
import { tags } from './tag';

export const photoTags = pgTable('photo_tags', {
  photoId: uuid('photo_id').notNull().references(() => photos.id, { onDelete: 'cascade' }),
  tagId: uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.photoId, table.tagId] }),
  tagIdIdx: index('photo_tags_tag_id_idx').on(table.tagId),
}));

export const photoTagSelectSchema = createSelectSchema(photoTags);
export const photoTagInsertSchema = createInsertSchema(photoTags);

export type PhotoTag = typeof photoTags.$inferSelect;
export type NewPhotoTag = typeof photoTags.$inferInsert;