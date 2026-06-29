import {
  pgTable, serial, integer, text, bigint, boolean, date, timestamp, index, uniqueIndex,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { accounts } from './accounts';

export const transactions = pgTable(
  'transactions',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    accountId: integer('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    date: date('date').notNull(),
    description: text('description').notNull(),
    rawDescription: text('raw_description').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    category: text('category').notNull().default('Needs Review'),
    subcategory: text('subcategory'),
    tags: text('tags').array().notNull().default([]),
    sourceFile: text('source_file'),
    sourceEmailId: integer('source_email_id'),
    plaidTxnId: text('plaid_txn_id'),
    parentTransactionId: integer('parent_transaction_id').references(
      (): AnyPgColumn => transactions.id,
      { onDelete: 'cascade' },
    ),
    pending: boolean('pending').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
  },
  (t) => ({
    userDateIdx: index('transactions_user_date_idx').on(t.userId, t.date),
    userCategoryIdx: index('transactions_user_category_idx').on(t.userId, t.category),
    userAccountIdx: index('transactions_user_account_idx').on(t.userId, t.accountId),
    descIdx: index('transactions_desc_idx').on(t.description),
    plaidIdUnique: uniqueIndex('transactions_plaid_unique').on(t.plaidTxnId),
    dedupeUnique: uniqueIndex('transactions_dedupe_unique').on(
      t.userId, t.date, t.description, t.amountCents, t.sourceFile,
    ),
  }),
);

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
