import { describe, expect, it } from 'vitest';
import { rupeesToCents, centsToRupees, formatCurrency } from '../src/money';

describe('rupeesToCents', () => {
  it('handles whole numbers', () => {
    expect(rupeesToCents(100)).toBe(10000);
  });
  it('handles decimals safely (no FP drift)', () => {
    expect(rupeesToCents(0.1 + 0.2)).toBe(30);
    expect(rupeesToCents(19.99)).toBe(1999);
  });
  it('handles negatives', () => {
    expect(rupeesToCents(-12.34)).toBe(-1234);
  });
});

describe('centsToRupees', () => {
  it('round-trips', () => {
    expect(centsToRupees(rupeesToCents(123.45))).toBe(123.45);
  });
});

describe('formatCurrency', () => {
  it('formats USD', () => {
    expect(formatCurrency(1234567, 'USD')).toBe('$12,345.67');
  });
  it('formats INR with rupee sign', () => {
    expect(formatCurrency(1234567, 'INR')).toMatch(/₹/);
  });
  it('uses U+2212 for negatives', () => {
    expect(formatCurrency(-1000, 'USD')).toContain('\u2212');
    expect(formatCurrency(-1000, 'USD')).not.toContain('-');
  });
  it('always shows the sign on positives when withSign=true', () => {
    expect(formatCurrency(1000, 'USD', { withSign: true })).toContain('+');
  });
});
