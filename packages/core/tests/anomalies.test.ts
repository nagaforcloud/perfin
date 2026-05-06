import { describe, expect, it } from 'vitest';
import { detectAnomalies } from '../src/anomalies/detect';

const txn = (id: number, amount: number, description: string, date = '2026-04-15') => ({
  id, amountCents: Math.round(amount * 100), description, date, category: 'Shopping',
});

describe('detectAnomalies', () => {
  it('flags a transaction 4× larger than category median', () => {
    const txns = [
      ...Array.from({ length: 10 }, (_, i) => txn(i, -100 - i, 'Coffee')),
      txn(99, -2000, 'Apple Store'),
    ];
    const out = detectAnomalies({ transactions: txns });
    const apple = out.find((a) => a.transactionId === 99);
    expect(apple).toBeDefined();
    expect(apple?.kind).toBe('large_amount');
    expect(apple?.score).toBeGreaterThan(0.7);
  });

  it('does not flag normal-sized transactions', () => {
    const txns = Array.from({ length: 10 }, (_, i) => txn(i, -100, 'Coffee'));
    expect(detectAnomalies({ transactions: txns })).toHaveLength(0);
  });

  it('flags a brand-new merchant when amount is large', () => {
    const txns = [
      ...Array.from({ length: 30 }, (_, i) => txn(i, -200, 'Whole Foods', '2026-03-01')),
      txn(99, -1500, 'Mystery Vendor LLC', '2026-04-15'),
    ];
    const out = detectAnomalies({ transactions: txns });
    const flagged = out.find((a) => a.transactionId === 99);
    expect(flagged?.kind).toMatch(/^(rare_merchant|large_amount)$/);
  });

  it('skips income', () => {
    const txns = [
      ...Array.from({ length: 5 }, (_, i) => txn(i, -100, 'X')),
      txn(99, 50000, 'Salary'),
    ];
    expect(detectAnomalies({ transactions: txns }).find((a) => a.transactionId === 99)).toBeUndefined();
  });
});
