import { describe, expect, it } from 'vitest';
import { normalizeDescription, hashRow } from '../src/text';

describe('normalizeDescription', () => {
  it('collapses whitespace and trims', () => {
    expect(normalizeDescription('  Whole   Foods   Market  ')).toBe('Whole Foods Market');
  });
  it('strips common bank junk', () => {
    expect(normalizeDescription('UPI/HDFC0000123/swiggy')).toBe('swiggy');
    expect(normalizeDescription('POS XXXX1234 STARBUCKS NEW YORK')).toBe('STARBUCKS NEW YORK');
  });
  it('removes trailing transaction codes', () => {
    expect(normalizeDescription('Amazon AMZN.COM 4FN8K2L1Q')).toBe('Amazon AMZN.COM');
  });
});

describe('hashRow', () => {
  it('produces a stable 8-hex hash', () => {
    const a = hashRow({ date: '2026-05-01', description: 'X', amountCents: 100, sourceFile: 'a.csv' });
    const b = hashRow({ date: '2026-05-01', description: 'X', amountCents: 100, sourceFile: 'a.csv' });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });
  it('differs when any field changes', () => {
    const a = hashRow({ date: '2026-05-01', description: 'X', amountCents: 100, sourceFile: 'a.csv' });
    const b = hashRow({ date: '2026-05-02', description: 'X', amountCents: 100, sourceFile: 'a.csv' });
    expect(a).not.toBe(b);
  });
});
