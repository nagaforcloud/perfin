import { pgTable, serial, integer, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';
import { subscriptionStatusEnum, planEnum } from '../enums';

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    stripeSubscriptionId: text('stripe_subscription_id').notNull(),
    stripePriceId: text('stripe_price_id').notNull(),
    plan: planEnum('plan').notNull(),
    status: subscriptionStatusEnum('status').notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: text('cancel_at_period_end'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: uniqueIndex('subscriptions_user_idx').on(t.userId),
    stripeIdx: uniqueIndex('subscriptions_stripe_id_unique').on(t.stripeSubscriptionId),
  }),
);

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
