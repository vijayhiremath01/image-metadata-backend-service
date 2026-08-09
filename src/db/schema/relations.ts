import { relations } from 'drizzle-orm';
import { categories } from './category';
import { tags } from './tag';
import { photos } from './photo';
import { photoCategories } from './photo-category';
import { photoTags } from './photo-tag';
import { photoLikes } from './like';
import { photoViews } from './view';
import { photoDownloads } from './download';
import { users } from './user';
import { sessions } from './session';

export const categoriesRelations = relations(categories, ({ many }) => ({
  photoCategories: many(photoCategories),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  photoTags: many(photoTags),
}));

export const photosRelations = relations(photos, ({ many, one }) => ({
  user: one(users, {
    fields: [photos.userId],
    references: [users.id],
  }),
  photoCategories: many(photoCategories),
  photoTags: many(photoTags),
  likes: many(photoLikes),
  views: many(photoViews),
  downloads: many(photoDownloads),
}));

export const photoCategoriesRelations = relations(photoCategories, ({ one }) => ({
  photo: one(photos, {
    fields: [photoCategories.photoId],
    references: [photos.id],
  }),
  category: one(categories, {
    fields: [photoCategories.categoryId],
    references: [categories.id],
  }),
}));

export const photoTagsRelations = relations(photoTags, ({ one }) => ({
  photo: one(photos, {
    fields: [photoTags.photoId],
    references: [photos.id],
  }),
  tag: one(tags, {
    fields: [photoTags.tagId],
    references: [tags.id],
  }),
}));

export const photoLikesRelations = relations(photoLikes, ({ one }) => ({
  photo: one(photos, {
    fields: [photoLikes.photoId],
    references: [photos.id],
  }),
  user: one(users, {
    fields: [photoLikes.userId],
    references: [users.id],
  }),
}));

export const photoViewsRelations = relations(photoViews, ({ one }) => ({
  photo: one(photos, {
    fields: [photoViews.photoId],
    references: [photos.id],
  }),
}));

export const photoDownloadsRelations = relations(photoDownloads, ({ one }) => ({
  photo: one(photos, {
    fields: [photoDownloads.photoId],
    references: [photos.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  photos: many(photos),
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));