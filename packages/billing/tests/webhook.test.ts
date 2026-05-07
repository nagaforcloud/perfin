import { describe, expect, it } from 'vitest';
import { interpretEvent } from '../src/webhook';

describe('interpretEvent', () => {
  it('reads subscription create as plan upgrade', () => {
    const evt = {
      type: 'customer.subscription.created',
      data: { object: { id: 'sub_1', customer: 'cus_1', status: 'active', items: { data: [{ price: { id: 'price_plus' } }] }, current_period_end: 1800000000, cancel_at_period_end: false } },
    } as unknown as Parameters<typeof interpretEvent>[0]['event'];
    const out = interpretEvent({ event: evt, prices: { plus: 'price_plus', pro: 'price_pro' } });
    expect(out).toEqual({
      kind: 'upsert',
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      stripePriceId: 'price_plus',
      plan: 'plus',
      status: 'active',
      currentPeriodEnd: new Date(1800000000 * 1000),
      cancelAtPeriodEnd: false,
    });
  });

  it('reads subscription delete as cancellation', () => {
    const evt = {
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_1', customer: 'cus_1' } },
    } as unknown as Parameters<typeof interpretEvent>[0]['event'];
    const out = interpretEvent({ event: evt, prices: { plus: 'price_plus', pro: 'price_pro' } });
    expect(out).toEqual({ kind: 'cancel', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1' });
  });

  it('returns null for unrelated events', () => {
    const evt = { type: 'invoice.created', data: { object: {} } } as unknown as Parameters<typeof interpretEvent>[0]['event'];
    expect(interpretEvent({ event: evt, prices: { plus: '', pro: '' } })).toBeNull();
  });
});
