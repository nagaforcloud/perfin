import { describe, expect, it } from 'vitest';
import { __test as ft } from '../src/tools/forecast-cashflow';

describe('cashflow forecast helper', () => {
  it('projects flat using last-30-day average', () => {
    const txns = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, '0')}`,
      amountCents: -100,
    }));
    const out = ft.project({ transactions: txns, days: 30, todayIso: '2026-04-30' });
    expect(out.dailyAvgCents).toBe(-100);
    expect(out.projectedCents).toBe(-3000);
  });

  it('returns 0 projection on empty input', () => {
    const out = ft.project({ transactions: [], days: 30, todayIso: '2026-04-30' });
    expect(out.dailyAvgCents).toBe(0);
    expect(out.projectedCents).toBe(0);
  });
});
