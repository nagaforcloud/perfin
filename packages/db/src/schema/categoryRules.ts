import {
  pgTable, serial, integer, text, timestamp, index,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const categoryRules = pgTable(
  'category_rules',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    priority: integer('priority').notNull().default(5),
    matchType: text('match_type').notNull(),
    pattern: text('pattern').notNull(),
    category: text('category').notNull(),
    createdBy: text('created_by').notNull().default('user'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userPriorityIdx: index('category_rules_user_priority_idx').on(t.userId, t.priority),
  }),
);

export type CategoryRule = typeof categoryRules.$inferSelect;
export type NewCategoryRule = typeof categoryRules.$inferInsert;
