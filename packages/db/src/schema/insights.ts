import {
  pgTable, serial, integer, text, real, jsonb, boolean, timestamp, index,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { insightSurfaceEnum } from '../enums';

export const insights = pgTable(
  'insights',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    headline: text('headline').notNull(),
    body: text('body').notNull(),
    payload: jsonb('payload').notNull().default({}),
    confidence: real('confidence').notNull(),
    surface: insightSurfaceEnum('surface').notNull().default('insights'),
    actionTaken: boolean('action_taken').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => ({
    userKindIdx: index('insights_user_kind_idx').on(t.userId, t.kind),
    surfaceIdx: index('insights_surface_idx').on(t.userId, t.surface),
  }),
);

export type Insight = typeof insights.$inferSelect;
export type NewInsight = typeof insights.$inferInsert;
