import { pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { planEnum } from '../enums';

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    plan: planEnum('plan').notNull().default('free'),
    stripeCustomerId: text('stripe_customer_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailUnique: uniqueIndex('users_email_unique').on(t.email),
    stripeCustomerIdx: uniqueIndex('users_stripe_customer_unique').on(t.stripeCustomerId),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
