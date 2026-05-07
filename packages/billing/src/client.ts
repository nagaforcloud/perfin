import Stripe from 'stripe';

export function createStripe(apiKey: string): Stripe {
  return new Stripe(apiKey, { apiVersion: '2024-11-20.acacia' });
}

export type { Stripe };
