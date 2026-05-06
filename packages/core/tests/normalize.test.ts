import { describe, expect, it } from 'vitest';
import { normalizeRow, type RawRow } from '../src/normalize';

describe('normalizeRow', () => {
  it('produces a NormalizedTxn with cents and cleaned description', () => {
    const raw: RawRow = {
      date: '2026-05-01',
      description: '  Whole   Foods  Market  ',
      amount: -84.20,
      sourceFile: 'apr.csv',
    };
    const out = normalizeRow(raw);
    expect(out.date).toBe('2026-05-01');
    expect(out.description).toBe('Whole Foods Market');
    expect(out.rawDescription).toBe('  Whole   Foods  Market  ');
    expect(out.amountCents).toBe(-8420);
    expect(out.sourceFile).toBe('apr.csv');
    expect(out.dedupeHash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('parses dd/mm/yyyy', () => {
    const out = normalizeRow({
      date: '01/05/2026', description: 'X', amount: 1, sourceFile: null,
    });
    expect(out.date).toBe('2026-05-01');
  });

  it('parses mm/dd/yyyy when locale=US', () => {
    const out = normalizeRow({
      date: '05/01/2026', description: 'X', amount: 1, sourceFile: null,
    }, { locale: 'US' });
    expect(out.date).toBe('2026-05-01');
  });

  it('throws on unparseable date', () => {
    expect(() => normalizeRow({
      date: 'lol', description: 'X', amount: 1, sourceFile: null,
    })).toThrow(/date/i);
  });
});
