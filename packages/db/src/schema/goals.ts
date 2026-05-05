import {
  pgTable, serial, integer, text, bigint, date, timestamp, index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { accounts } from './accounts.js';
import { goalStatusEnum } from '../enums.js';

export const goals = pgTable(
  'goals',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    targetCents: bigint('target_cents', { mode: 'number' }).notNull(),
    savedCents: bigint('saved_cents', { mode: 'number' }).notNull().default(0),
    deadline: date('deadline'),
    sourceAccountId: integer('source_account_id').references(() => accounts.id, { onDelete: 'set null' }),
    status: goalStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('goals_user_idx').on(t.userId),
  }),
);

export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
