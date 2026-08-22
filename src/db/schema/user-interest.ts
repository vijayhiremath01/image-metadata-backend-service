import { pgTable, uuid, varchar, integer, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './user';

export const userInterests = pgTable('user_interests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  topic: varchar('topic', { length: 100 }).notNull(),
  score: integer('score').default(0).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('user_interests_user_id_idx').on(table.userId),
  topicIdx: index('user_interests_topic_idx').on(table.topic),
  uniqueUserTopic: uniqueIndex('user_interests_unique').on(table.userId, table.topic),
}));

export type UserInterest = typeof userInterests.$inferSelect;
export type NewUserInterest = typeof userInterests.$inferInsert;