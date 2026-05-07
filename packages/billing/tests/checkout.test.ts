import { describe, expect, it, vi } from 'vitest';
import { createCheckoutSession, createPortalSession } from '../src/checkout';

describe('createCheckoutSession', () => {
  it('creates a Stripe customer if user has none, and returns checkout url', async () => {
    const stripe = {
      customers: { create: vi.fn().mockResolvedValue({ id: 'cus_123' }) },
      checkout: { sessions: { create: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe/test' }) } },
    } as unknown as Parameters<typeof createCheckoutSession>[0]['stripe'];

    const result = await createCheckoutSession({
      stripe, userId: 1, email: 'a@b.com', stripeCustomerId: null,
      priceId: 'price_plus', successUrl: 'https://app/success', cancelUrl: 'https://app/cancel',
    });
    expect(result.url).toBe('https://checkout.stripe/test');
    expect(result.stripeCustomerId).toBe('cus_123');
    expect(stripe.customers.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'a@b.com', metadata: { userId: '1' } }));
  });

  it('reuses existing stripe_customer_id', async () => {
    const stripe = {
      customers: { create: vi.fn() },
      checkout: { sessions: { create: vi.fn().mockResolvedValue({ url: 'https://x' }) } },
    } as unknown as Parameters<typeof createCheckoutSession>[0]['stripe'];

    const result = await createCheckoutSession({
      stripe, userId: 1, email: 'a@b.com', stripeCustomerId: 'cus_existing',
      priceId: 'price_plus', successUrl: 'https://app/success', cancelUrl: 'https://app/cancel',
    });
    expect(result.stripeCustomerId).toBe('cus_existing');
    expect(stripe.customers.create).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_existing' }));
  });
});

describe('createPortalSession', () => {
  it('returns portal url', async () => {
    const stripe = {
      billingPortal: { sessions: { create: vi.fn().mockResolvedValue({ url: 'https://billing.stripe' }) } },
    } as unknown as Parameters<typeof createPortalSession>[0]['stripe'];
    const out = await createPortalSession({ stripe, stripeCustomerId: 'cus_x', returnUrl: 'https://app/back' });
    expect(out.url).toBe('https://billing.stripe');
  });
});
