import { pgTable, serial, integer, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { chatThreads } from './chatThreads';
import { proposalStatusEnum } from '../enums';

export const agentProposals = pgTable(
  'agent_proposals',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    threadId: integer('thread_id').references(() => chatThreads.id, { onDelete: 'cascade' }),
    tool: text('tool').notNull(),
    input: jsonb('input').notNull(),
    preview: text('preview').notNull(),
    status: proposalStatusEnum('status').notNull().default('pending'),
    output: jsonb('output'),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userStatusIdx: index('agent_proposals_user_status_idx').on(t.userId, t.status),
  }),
);

export type AgentProposal = typeof agentProposals.$inferSelect;
export type NewAgentProposal = typeof agentProposals.$inferInsert;
