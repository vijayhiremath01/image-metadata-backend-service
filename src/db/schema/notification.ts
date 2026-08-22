import { pgTable, uuid, varchar, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './user';
import { photos } from './photo';

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(),
  photoId: uuid('photo_id').references(() => photos.id, { onDelete: 'cascade' }),
  read: boolean('read').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('notifications_user_id_idx').on(table.userId),
  actorIdx: index('notifications_actor_id_idx').on(table.actorId),
  photoIdx: index('notifications_photo_id_idx').on(table.photoId),
  readIdx: index('notifications_read_idx').on(table.read),
}));

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export const NOTIFICATION_TYPES = {
  LIKE: 'like',
  FOLLOW: 'follow',
  COMMENT: 'comment',
  SAVE: 'save',
} as const;