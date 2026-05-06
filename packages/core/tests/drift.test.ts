import { describe, expect, it } from 'vitest';
import { detectCategoryDrift } from '../src/insights/drift';

const t = (date: string, category: string, amount: number) => ({
  date, category, amountCents: Math.round(amount * 100), id: 0, description: 'X',
});

describe('detectCategoryDrift', () => {
  it('flags a 50% jump month-over-month', () => {
    const txns = [
      ...Array.from({ length: 10 }, () => t('2026-03-15', 'Dining', -100)),
      ...Array.from({ length: 16 }, () => t('2026-04-15', 'Dining', -100)),
    ];
    const out = detectCategoryDrift({ transactions: txns, currentMonth: '2026-04' });
    const dining = out.find((d) => d.category === 'Dining');
    expect(dining?.changePct).toBeGreaterThanOrEqual(50);
  });

  it('does not flag <20% changes', () => {
    const txns = [
      ...Array.from({ length: 10 }, () => t('2026-03-15', 'Dining', -100)),
      ...Array.from({ length: 11 }, () => t('2026-04-15', 'Dining', -100)),
    ];
    const out = detectCategoryDrift({ transactions: txns, currentMonth: '2026-04' });
    expect(out.find((d) => d.category === 'Dining')).toBeUndefined();
  });
});
