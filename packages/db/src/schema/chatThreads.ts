import { pgTable, serial, integer, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const chatThreads = pgTable(
  'chat_threads',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default('Untitled'),
    pinned: boolean('pinned').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('chat_threads_user_idx').on(t.userId),
  }),
);

export type ChatThread = typeof chatThreads.$inferSelect;
export type NewChatThread = typeof chatThreads.$inferInsert;
