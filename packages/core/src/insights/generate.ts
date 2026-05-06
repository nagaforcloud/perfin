import { detectAnomalies } from '../anomalies/detect';
import { detectRecurring } from '../recurring/detect';
import { detectCategoryDrift } from './drift';
import type { InsightProposal } from './types';

export interface GenerateInput {
  transactions: Array<{
    id: number;
    date: string;
    description: string;
    amountCents: number;
    category: string;
  }>;
  currentMonth: string;
  formatCurrency: (cents: number) => string;
  monthlyNarrative?: { headline: string; body: string };
}

export function generateInsightProposals(input: GenerateInput): InsightProposal[] {
  const out: InsightProposal[] = [];

  for (const a of detectAnomalies({ transactions: input.transactions })) {
    out.push({
      kind: 'anomaly',
      headline: `Unusual transaction flagged`,
      body: a.reason,
      payload: { transactionId: a.transactionId, anomalyKind: a.kind },
      confidence: a.score,
      surface: a.score >= 0.85 ? 'home' : 'insights',
    });
  }

  for (const r of detectRecurring({ transactions: input.transactions })) {
    out.push({
      kind: 'recurring_detected',
      headline: `${r.merchant} appears ${r.cadence}`,
      body: `${r.occurrences} charges around ${input.formatCurrency(r.amountCents)} since ${r.firstSeen}.`,
      payload: { merchant: r.merchant, cadence: r.cadence, amountCents: r.amountCents, transactionIds: r.transactionIds },
      confidence: r.confidence,
      surface: 'insights',
    });
  }

  for (const d of detectCategoryDrift({ transactions: input.transactions, currentMonth: input.currentMonth })) {
    const direction = d.changePct >= 0 ? 'up' : 'down';
    out.push({
      kind: 'category_drift',
      headline: `${d.category} is ${direction} ${Math.abs(d.changePct).toFixed(0)}% this month`,
      body: `${input.formatCurrency(d.currentSpendCents)} this month vs ${input.formatCurrency(d.previousSpendCents)} last month.`,
      payload: { category: d.category, changePct: d.changePct },
      confidence: Math.min(1, Math.abs(d.changePct) / 100),
      surface: Math.abs(d.changePct) >= 50 ? 'home' : 'insights',
    });
  }

  if (input.monthlyNarrative) {
    out.push({
      kind: 'monthly_narrative',
      headline: input.monthlyNarrative.headline,
      body: input.monthlyNarrative.body,
      payload: {},
      confidence: 1,
      surface: 'insights',
    });
  }

  return out.sort((a, b) => b.confidence - a.confidence);
}
