import { pgTable, uuid, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './user';

export const userFollows = pgTable('user_follows', {
  id: uuid('id').primaryKey().defaultRandom(),
  followerId: uuid('follower_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  followingId: uuid('following_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  followerIdx: index('user_follows_follower_id_idx').on(table.followerId),
  followingIdx: index('user_follows_following_id_idx').on(table.followingId),
  uniqueFollow: uniqueIndex('user_follows_unique').on(table.followerId, table.followingId),
}));

export type UserFollow = typeof userFollows.$inferSelect;
export type NewUserFollow = typeof userFollows.$inferInsert;