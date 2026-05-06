import type { Cadence } from './types';

export function medianGap(isoDates: string[]): number | null {
  if (isoDates.length < 2) return null;
  const sorted = [...isoDates].sort();
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const a = Date.parse(sorted[i - 1]!);
    const b = Date.parse(sorted[i]!);
    gaps.push(Math.round((b - a) / (1000 * 60 * 60 * 24)));
  }
  gaps.sort((x, y) => x - y);
  const mid = Math.floor(gaps.length / 2);
  return gaps.length % 2 === 0 ? Math.round((gaps[mid - 1]! + gaps[mid]!) / 2) : gaps[mid]!;
}

export function classifyCadence(days: number): Cadence | null {
  if (days >= 5 && days <= 9)    return 'weekly';
  if (days >= 25 && days <= 35)  return 'monthly';
  if (days >= 85 && days <= 95)  return 'quarterly';
  if (days >= 350 && days <= 380) return 'annual';
  return null;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
