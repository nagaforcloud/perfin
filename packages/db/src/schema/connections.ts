import { pgTable, serial, integer, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { connectionStatusEnum } from '../enums';

export const connections = pgTable(
  'connections',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id'),
    accessTokenEnc: text('access_token_enc'),
    cursor: text('cursor'),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    status: connectionStatusEnum('status').notNull().default('active'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('connections_user_idx').on(t.userId),
  }),
);

export type Connection = typeof connections.$inferSelect;
export type NewConnection = typeof connections.$inferInsert;
