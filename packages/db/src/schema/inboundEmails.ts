import {
  pgTable, serial, integer, text, timestamp, index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { transactions } from './transactions.js';
import { inboundEmailStatusEnum } from '../enums.js';

export const inboundEmails = pgTable(
  'inbound_emails',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    from: text('from').notNull(),
    subject: text('subject').notNull().default(''),
    bodyHash: text('body_hash').notNull(),
    parsedTxnId: integer('parsed_txn_id').references(() => transactions.id, { onDelete: 'set null' }),
    status: inboundEmailStatusEnum('status').notNull().default('received'),
    error: text('error'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('inbound_emails_user_idx').on(t.userId),
  }),
);

export type InboundEmail = typeof inboundEmails.$inferSelect;
export type NewInboundEmail = typeof inboundEmails.$inferInsert;
