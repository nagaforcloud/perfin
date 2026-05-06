import { describe, expect, it } from 'vitest';
import { medianGap, classifyCadence } from '../src/recurring/cadence';
import { detectRecurring, type DetectInput } from '../src/recurring/detect';

describe('medianGap', () => {
  it('returns median day gap between consecutive ISO dates', () => {
    expect(medianGap(['2026-01-01', '2026-02-01', '2026-03-01'])).toBe(30);
    expect(medianGap(['2026-01-01', '2026-01-08', '2026-01-15'])).toBe(7);
  });
  it('returns null when fewer than 2 dates', () => {
    expect(medianGap(['2026-01-01'])).toBeNull();
    expect(medianGap([])).toBeNull();
  });
});

describe('classifyCadence', () => {
  it('classifies weekly (5..9 days)', () => {
    expect(classifyCadence(7)).toBe('weekly');
  });
  it('classifies monthly (25..35 days)', () => {
    expect(classifyCadence(30)).toBe('monthly');
    expect(classifyCadence(31)).toBe('monthly');
  });
  it('classifies quarterly (85..95 days)', () => {
    expect(classifyCadence(90)).toBe('quarterly');
  });
  it('classifies annual (350..380 days)', () => {
    expect(classifyCadence(365)).toBe('annual');
  });
  it('returns null when noisy', () => {
    expect(classifyCadence(20)).toBeNull();
    expect(classifyCadence(60)).toBeNull();
  });
});

const month = (mm: string, day = '15') => `2026-${mm}-${day}`;

const txns = (overrides: Partial<DetectInput['transactions'][number]>[]) =>
  overrides.map((o, i) => ({
    id: i + 1,
    description: 'X',
    amountCents: -1000,
    date: '2026-01-01',
    category: 'Subscription',
    ...o,
  }));

describe('detectRecurring', () => {
  it('finds a 3-month Spotify series with high confidence', () => {
    const input: DetectInput = {
      transactions: txns([
        { description: 'SPOTIFY', amountCents: -1099, date: month('01') },
        { description: 'SPOTIFY', amountCents: -1099, date: month('02') },
        { description: 'SPOTIFY', amountCents: -1099, date: month('03') },
      ]),
      amountTolerance: 0.15,
    };
    const series = detectRecurring(input);
    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({
      merchant: 'spotify',
      cadence: 'monthly',
      occurrences: 3,
      amountCents: -1099,
    });
    expect(series[0]?.confidence).toBeGreaterThan(0.7);
  });

  it('tolerates ±15% amount variation', () => {
    const input: DetectInput = {
      transactions: txns([
        { description: 'JIO MOBILE', amountCents: -29900, date: month('01') },
        { description: 'JIO MOBILE', amountCents: -32000, date: month('02') },
        { description: 'JIO MOBILE', amountCents: -29500, date: month('03') },
      ]),
      amountTolerance: 0.15,
    };
    const series = detectRecurring(input);
    expect(series).toHaveLength(1);
    expect(series[0]?.merchant).toBe('jio mobile');
  });

  it('skips clusters below minOccurrences', () => {
    const input: DetectInput = {
      transactions: txns([
        { description: 'SPOTIFY', amountCents: -1099, date: month('01') },
        { description: 'SPOTIFY', amountCents: -1099, date: month('02') },
      ]),
      amountTolerance: 0.15,
      minOccurrences: 3,
    };
    expect(detectRecurring(input)).toHaveLength(0);
  });

  it('does not merge merchants that differ', () => {
    const input: DetectInput = {
      transactions: txns([
        { description: 'NETFLIX', amountCents: -1499, date: month('01') },
        { description: 'NETFLIX', amountCents: -1499, date: month('02') },
        { description: 'NETFLIX', amountCents: -1499, date: month('03') },
        { description: 'SPOTIFY', amountCents: -1099, date: month('01') },
        { description: 'SPOTIFY', amountCents: -1099, date: month('02') },
        { description: 'SPOTIFY', amountCents: -1099, date: month('03') },
      ]),
      amountTolerance: 0.15,
    };
    const series = detectRecurring(input).map((s) => s.merchant).sort();
    expect(series).toEqual(['netflix', 'spotify']);
  });
});
