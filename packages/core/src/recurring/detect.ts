import { addDays, classifyCadence, medianGap } from './cadence';
import type { RecurringSeriesProposal } from './types';

export interface DetectInput {
  transactions: Array<{
    id: number;
    description: string;
    amountCents: number;
    date: string;
    category: string;
  }>;
  amountTolerance?: number;
  minOccurrences?: number;
}

function merchantKey(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 2)
    .join(' ');
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function stdRatio(values: number[], mean: number): number {
  if (mean === 0 || values.length < 2) return 0;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

export function detectRecurring(input: DetectInput): RecurringSeriesProposal[] {
  const tolerance = input.amountTolerance ?? 0.15;
  const minOccurrences = input.minOccurrences ?? 3;

  const groups = new Map<string, DetectInput['transactions']>();
  for (const t of input.transactions) {
    if (t.amountCents >= 0) continue;
    const key = merchantKey(t.description);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }

  const series: RecurringSeriesProposal[] = [];
  for (const [key, group] of groups) {
    if (group.length < minOccurrences) continue;
    const med = median(group.map((g) => Math.abs(g.amountCents)));
    const inTolerance = group.filter((g) => Math.abs(Math.abs(g.amountCents) - med) / med <= tolerance);
    if (inTolerance.length < minOccurrences) continue;

    const dates = inTolerance.map((g) => g.date).sort();
    const gap = medianGap(dates);
    const cadence = gap == null ? null : classifyCadence(gap);
    if (!cadence) continue;

    const lastSeen = dates[dates.length - 1]!;
    const expectedDays = { weekly: 7, monthly: 30, quarterly: 90, annual: 365 }[cadence];

    const dateConsistency = inTolerance.length / group.length;
    const amountStdRatio = stdRatio(inTolerance.map((g) => Math.abs(g.amountCents)), med);
    const confidence = Math.min(1, 0.5 + 0.3 * dateConsistency + 0.2 * (1 - amountStdRatio));

    series.push({
      merchant: key,
      category: inTolerance[0]!.category,
      amountCents: -Math.round(med),
      cadence,
      occurrences: inTolerance.length,
      firstSeen: dates[0]!,
      lastSeen,
      nextExpectedAt: addDays(lastSeen, expectedDays),
      confidence,
      transactionIds: inTolerance.map((g) => g.id),
    });
  }
  return series.sort((a, b) => b.confidence - a.confidence);
}
