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
import { userFollows } from './user-follow';
import { boards } from './board';
import { boardPhotos } from './board';
import { photoComments } from './photo-comment';
import { notifications } from './notification';
import { userInterests } from './user-interest';
import { photoAnalytics } from './photo-analytics';

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
  comments: many(photoComments),
  boardPhotos: many(boardPhotos),
  analytics: one(photoAnalytics, {
    fields: [photos.id],
    references: [photoAnalytics.photoId],
  }),
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

export const photoCommentsRelations = relations(photoComments, ({ one }) => ({
  photo: one(photos, {
    fields: [photoComments.photoId],
    references: [photos.id],
  }),
  user: one(users, {
    fields: [photoComments.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many, one }) => ({
  photos: many(photos),
  sessions: many(sessions),
  followers: many(userFollows, { relationName: 'following' }),
  following: many(userFollows, { relationName: 'follower' }),
  boards: many(boards),
  comments: many(photoComments),
  notifications: many(notifications),
  interests: many(userInterests),
  actorNotifications: many(notifications, { relationName: 'actor' }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const userFollowsRelations = relations(userFollows, ({ one }) => ({
  follower: one(users, {
    fields: [userFollows.followerId],
    references: [users.id],
    relationName: 'follower',
  }),
  following: one(users, {
    fields: [userFollows.followingId],
    references: [users.id],
    relationName: 'following',
  }),
}));

export const boardsRelations = relations(boards, ({ one, many }) => ({
  user: one(users, {
    fields: [boards.userId],
    references: [users.id],
  }),
  coverPhoto: one(photos, {
    fields: [boards.coverPhotoId],
    references: [photos.id],
  }),
  boardPhotos: many(boardPhotos),
}));

export const boardPhotosRelations = relations(boardPhotos, ({ one }) => ({
  board: one(boards, {
    fields: [boardPhotos.boardId],
    references: [boards.id],
  }),
  photo: one(photos, {
    fields: [boardPhotos.photoId],
    references: [photos.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  actor: one(users, {
    fields: [notifications.actorId],
    references: [users.id],
    relationName: 'actor',
  }),
  photo: one(photos, {
    fields: [notifications.photoId],
    references: [photos.id],
  }),
}));

export const userInterestsRelations = relations(userInterests, ({ one }) => ({
  user: one(users, {
    fields: [userInterests.userId],
    references: [users.id],
  }),
}));

export const photoAnalyticsRelations = relations(photoAnalytics, ({ one }) => ({
  photo: one(photos, {
    fields: [photoAnalytics.photoId],
    references: [photos.id],
  }),
}));