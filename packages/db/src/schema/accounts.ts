import {
  pgTable, serial, integer, text, bigint, timestamp, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { connections } from './connections';

export const accounts = pgTable(
  'accounts',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    connectionId: integer('connection_id').references(() => connections.id, { onDelete: 'set null' }),
    plaidAccountId: text('plaid_account_id'),
    name: text('name').notNull(),
    bank: text('bank').notNull().default(''),
    type: text('type').notNull().default('checking'),
    currency: text('currency').notNull().default('INR'),
    color: text('color').notNull().default('#6366f1'),
    balanceCents: bigint('balance_cents', { mode: 'number' }).notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('accounts_user_idx').on(t.userId),
    nameUnique: uniqueIndex('accounts_user_name_unique').on(t.userId, t.name),
  }),
);

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
