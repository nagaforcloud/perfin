import type Stripe from 'stripe';
import { planForPriceId, type PriceMap, type Plan } from './plan';

export interface InterpretInput {
  event: Stripe.Event;
  prices: PriceMap;
}

export type InterpretedEvent =
  | {
      kind: 'upsert';
      stripeCustomerId: string;
      stripeSubscriptionId: string;
      stripePriceId: string;
      plan: Plan;
      status: string;
      currentPeriodEnd: Date | null;
      cancelAtPeriodEnd: boolean;
    }
  | {
      kind: 'cancel';
      stripeCustomerId: string;
      stripeSubscriptionId: string;
    };

export function interpretEvent({ event, prices }: InterpretInput): InterpretedEvent | null {
  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const sub = event.data.object as unknown as {
      id: string;
      customer: string;
      status: string;
      items: { data: Array<{ price: { id: string } }> };
      current_period_end?: number | null;
      cancel_at_period_end?: boolean;
    };
    const priceId = sub.items.data[0]?.price.id ?? '';
    const plan = planForPriceId(priceId, prices);
    if (!plan) return null;
    return {
      kind: 'upsert',
      stripeCustomerId: sub.customer,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      plan,
      status: sub.status,
      currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
      cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    };
  }
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as unknown as { id: string; customer: string };
    return { kind: 'cancel', stripeCustomerId: sub.customer, stripeSubscriptionId: sub.id };
  }
  return null;
}
