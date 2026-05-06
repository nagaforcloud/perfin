import { describe, expect, it } from 'vitest';
import { __test as nt } from '../src/insights/narrative';

describe('narrative summariser', () => {
  it('builds a deterministic stat block from txns', () => {
    const block = nt.buildStatBlock({
      currentMonth: '2026-04',
      transactions: [
        { id: 1, date: '2026-04-15', category: 'Income', amountCents: 800000, description: 'salary' },
        { id: 2, date: '2026-04-16', category: 'Food', amountCents: -50000, description: 'swiggy' },
        { id: 3, date: '2026-04-17', category: 'Rent', amountCents: -300000, description: 'rent' },
      ],
    });
    expect(block.income).toBe(800000);
    expect(block.expenses).toBe(350000);
    expect(block.savings).toBe(450000);
    expect(block.savingsRate).toBe(0.5625);
    expect(block.topCategory).toBe('Rent');
  });
});
