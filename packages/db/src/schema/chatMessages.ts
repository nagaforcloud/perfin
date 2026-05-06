import { pgTable, serial, integer, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { chatThreads } from './chatThreads';
import { chatRoleEnum } from '../enums';

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: serial('id').primaryKey(),
    threadId: integer('thread_id').notNull().references(() => chatThreads.id, { onDelete: 'cascade' }),
    role: chatRoleEnum('role').notNull(),
    content: text('content').notNull().default(''),
    toolCalls: jsonb('tool_calls'),
    toolResults: jsonb('tool_results'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    threadIdx: index('chat_messages_thread_idx').on(t.threadId, t.createdAt),
  }),
);

export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
