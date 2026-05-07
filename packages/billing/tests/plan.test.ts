import { describe, expect, it } from 'vitest';
import { hasFeature, isPlus, isPro, planForPriceId, FEATURES } from '../src/plan';

describe('plan helpers', () => {
  it('isPro covers Pro only', () => {
    expect(isPro('pro')).toBe(true);
    expect(isPro('plus')).toBe(false);
    expect(isPro('free')).toBe(false);
  });
  it('isPlus covers Plus and Pro', () => {
    expect(isPlus('plus')).toBe(true);
    expect(isPlus('pro')).toBe(true);
    expect(isPlus('free')).toBe(false);
  });

  it('FEATURES gates known capabilities by plan', () => {
    expect(hasFeature('free', FEATURES.PLAID_CONNECTIONS)).toBe(false);
    expect(hasFeature('plus', FEATURES.PLAID_CONNECTIONS)).toBe(true);
    expect(hasFeature('pro',  FEATURES.PLAID_CONNECTIONS)).toBe(true);
    expect(hasFeature('free', FEATURES.UNLIMITED_AGENT)).toBe(false);
    expect(hasFeature('plus', FEATURES.UNLIMITED_AGENT)).toBe(false);
    expect(hasFeature('pro',  FEATURES.UNLIMITED_AGENT)).toBe(true);
  });

  it('planForPriceId maps Stripe price ids to plan', () => {
    expect(planForPriceId('price_plus_monthly', { plus: 'price_plus_monthly', pro: 'price_pro_monthly' })).toBe('plus');
    expect(planForPriceId('price_pro_monthly', { plus: 'price_plus_monthly', pro: 'price_pro_monthly' })).toBe('pro');
    expect(planForPriceId('price_unknown', { plus: 'price_plus_monthly', pro: 'price_pro_monthly' })).toBe(null);
  });
});
