import {
  pgTable, serial, integer, text, jsonb, timestamp, index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const agentActions = pgTable(
  'agent_actions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tool: text('tool').notNull(),
    input: jsonb('input').notNull(),
    output: jsonb('output'),
    confirmedBy: integer('confirmed_by').references(() => users.id),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    undoneAt: timestamp('undone_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('agent_actions_user_idx').on(t.userId),
  }),
);

export type AgentAction = typeof agentActions.$inferSelect;
export type NewAgentAction = typeof agentActions.$inferInsert;
