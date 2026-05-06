import type { AnomalyProposal } from './types';

export interface AnomalyInput {
  transactions: Array<{
    id: number;
    amountCents: number;
    description: string;
    date: string;
    category: string;
  }>;
  hardLargeThresholdCents?: number;
  outlierMultiplier?: number;
  rareMerchantMinAmount?: number;
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function merchantKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 2).join(' ');
}

export function detectAnomalies(input: AnomalyInput): AnomalyProposal[] {
  const out: AnomalyProposal[] = [];
  const expenses = input.transactions.filter((t) => t.amountCents < 0);
  if (!expenses.length) return out;

  const hard = input.hardLargeThresholdCents ?? 5_00_000;
  const mult = input.outlierMultiplier ?? 4;
  const rareMin = input.rareMerchantMinAmount ?? 1_00_000;

  const byCategory = new Map<string, number[]>();
  for (const t of expenses) {
    const list = byCategory.get(t.category) ?? [];
    list.push(Math.abs(t.amountCents));
    byCategory.set(t.category, list);
  }
  const medianByCategory = new Map<string, number>();
  for (const [cat, vals] of byCategory) medianByCategory.set(cat, median(vals));

  const merchantCounts = new Map<string, number>();
  for (const t of expenses) {
    const k = merchantKey(t.description);
    merchantCounts.set(k, (merchantCounts.get(k) ?? 0) + 1);
  }

  for (const t of expenses) {
    const amt = Math.abs(t.amountCents);
    const med = medianByCategory.get(t.category) ?? 0;
    if (amt >= hard) {
      out.push({
        transactionId: t.id,
        kind: 'large_amount',
        score: Math.min(1, amt / (hard * 4)),
        reason: `Amount ${(amt / 100).toFixed(2)} crosses the large-transaction threshold.`,
      });
      continue;
    }
    if (med > 0 && amt >= med * mult) {
      out.push({
        transactionId: t.id,
        kind: 'large_amount',
        score: Math.min(1, amt / (med * mult * 2)),
        reason: `${(amt / 100).toFixed(2)} is ${(amt / med).toFixed(1)}× the typical ${t.category} amount.`,
      });
      continue;
    }
    const mk = merchantKey(t.description);
    if (mk && (merchantCounts.get(mk) ?? 0) <= 1 && amt >= rareMin) {
      out.push({
        transactionId: t.id,
        kind: 'rare_merchant',
        score: 0.6,
        reason: `First transaction with "${t.description}" and amount is unusually large.`,
      });
    }
  }
  return out;
}
