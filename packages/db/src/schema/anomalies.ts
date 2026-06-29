import {
  pgTable, serial, integer, text, real, timestamp, index,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { transactions } from './transactions';
import { anomalyStatusEnum } from '../enums';

export const anomalies = pgTable(
  'anomalies',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    transactionId: integer('transaction_id').notNull().references(() => transactions.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    score: real('score').notNull(),
    reason: text('reason').notNull(),
    status: anomalyStatusEnum('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userStatusIdx: index('anomalies_user_status_idx').on(t.userId, t.status),
  }),
);

export type Anomaly = typeof anomalies.$inferSelect;
export type NewAnomaly = typeof anomalies.$inferInsert;
