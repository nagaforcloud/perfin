import {
  pgTable, serial, integer, text, bigint, timestamp, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { accounts } from './accounts';

export const budgets = pgTable(
  'budgets',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    category: text('category').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    period: text('period').notNull().default('monthly'),
    accountId: integer('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex('budgets_user_cat_period_account_unique').on(
      t.userId, t.category, t.period, t.accountId,
    ),
  }),
);

export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
