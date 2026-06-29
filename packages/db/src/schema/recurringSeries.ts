import {
  pgTable, serial, integer, text, bigint, real, date, timestamp, index,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { recurringStatusEnum } from '../enums';

export const recurringSeries = pgTable(
  'recurring_series',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    merchant: text('merchant').notNull(),
    category: text('category').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    cadence: text('cadence').notNull(),
    nextExpectedAt: date('next_expected_at'),
    confidence: real('confidence').notNull(),
    firstSeen: date('first_seen').notNull(),
    lastSeen: date('last_seen').notNull(),
    status: recurringStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('recurring_series_user_idx').on(t.userId),
  }),
);

export type RecurringSeries = typeof recurringSeries.$inferSelect;
export type NewRecurringSeries = typeof recurringSeries.$inferInsert;
