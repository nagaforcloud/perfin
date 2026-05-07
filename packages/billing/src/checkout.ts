import type Stripe from 'stripe';

export interface CheckoutInput {
  stripe: Stripe;
  userId: number;
  email: string;
  stripeCustomerId: string | null;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutOutput {
  url: string;
  stripeCustomerId: string;
}

export async function createCheckoutSession(input: CheckoutInput): Promise<CheckoutOutput> {
  let customerId = input.stripeCustomerId;
  if (!customerId) {
    const cust = await input.stripe.customers.create({
      email: input.email,
      metadata: { userId: String(input.userId) },
    });
    customerId = cust.id;
  }

  const session = await input.stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    allow_promotion_codes: true,
  });

  if (!session.url) throw new Error('Stripe did not return a session URL');
  return { url: session.url, stripeCustomerId: customerId };
}

export interface PortalInput {
  stripe: Stripe;
  stripeCustomerId: string;
  returnUrl: string;
}

export async function createPortalSession(input: PortalInput): Promise<{ url: string }> {
  const session = await input.stripe.billingPortal.sessions.create({
    customer: input.stripeCustomerId,
    return_url: input.returnUrl,
  });
  return { url: session.url };
}
