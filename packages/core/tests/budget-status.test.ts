import { describe, expect, it } from 'vitest';
import { computeBudgetStatus } from '../src/budget/status';

const t = (date: string, category: string, amount: number) => ({
  date, category, amountCents: Math.round(amount * 100), id: 0, description: 'X',
});

describe('computeBudgetStatus', () => {
  it('returns spent/budget/remaining/percent for the current month', () => {
    const out = computeBudgetStatus({
      budgets: [{ id: 1, category: 'Dining', amountCents: 100000 }],
      transactions: [
        t('2026-04-01', 'Dining', -300),
        t('2026-04-02', 'Dining', -400),
        t('2026-03-15', 'Dining', -1000),
      ],
      currentMonth: '2026-04',
    });
    expect(out[0]).toMatchObject({
      category: 'Dining',
      budgetCents: 100000,
      spentCents: 70000,
      remainingCents: 30000,
      percent: 70,
    });
  });
});
