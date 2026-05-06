import { describe, expect, it } from 'vitest';
import { computeKpis } from '../src/home/kpi';

const t = (date: string, category: string, amount: number) => ({
  date, category, amountCents: Math.round(amount * 100), id: 0, description: 'X',
});

describe('computeKpis', () => {
  it('aggregates income, expenses, savings rate, top category', () => {
    const k = computeKpis({
      transactions: [
        t('2026-04-01', 'Income', 8000),
        t('2026-04-02', 'Food',   -500),
        t('2026-04-03', 'Rent',   -3000),
      ],
      currentMonth: '2026-04',
    });
    expect(k.incomeCents).toBe(800000);
    expect(k.expensesCents).toBe(350000);
    expect(k.savingsRate).toBeCloseTo(0.5625, 4);
    expect(k.topCategory.name).toBe('Rent');
    expect(k.topCategory.spendCents).toBe(300000);
  });

  it('returns zeros when month has no data', () => {
    const k = computeKpis({ transactions: [], currentMonth: '2026-04' });
    expect(k.incomeCents).toBe(0);
    expect(k.expensesCents).toBe(0);
    expect(k.savingsRate).toBe(0);
    expect(k.topCategory.name).toBe('\u2014');
  });
});
