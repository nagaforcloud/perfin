import { and, eq, sql } from 'drizzle-orm';
import { anomalies, insights, recurringSeries, transactions, type Db } from '@perfin/db';
import {
  detectAnomalies, detectRecurring,
  generateInsightProposals, generateNarrative,
  formatCurrency,
} from '@perfin/core';
import { env } from '../env.js';

export interface RegenerateInput {
  userId: string;
  db: Db;
  currency: string;
  withNarrative?: boolean;
}

export interface RegenerateOutput {
  insightCount: number;
  anomalyCount: number;
  recurringCount: number;
}

const isoMonth = (d = new Date()) => d.toISOString().slice(0, 7);

export async function regenerateForUser(input: RegenerateInput): Promise<RegenerateOutput> {
  const { userId, db, currency } = input;

  const txns = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      description: transactions.description,
      amountCents: transactions.amountCents,
      category: transactions.category,
    })
    .from(transactions)
    .where(eq(transactions.userId, userId));

  // Recurring
  await db.delete(recurringSeries).where(eq(recurringSeries.userId, userId));
  const recurring = detectRecurring({ transactions: txns });
  for (const r of recurring) {
    await db.insert(recurringSeries).values({
      userId,
      merchant: r.merchant,
      category: r.category,
      amountCents: r.amountCents,
      cadence: r.cadence,
      nextExpectedAt: r.nextExpectedAt,
      confidence: r.confidence,
      firstSeen: r.firstSeen,
      lastSeen: r.lastSeen,
      status: 'active',
    });
  }

  // Anomalies
  await db
    .delete(anomalies)
    .where(and(eq(anomalies.userId, userId), eq(anomalies.status, 'open')));
  const anomalyProposals = detectAnomalies({ transactions: txns });
  for (const a of anomalyProposals) {
    await db.insert(anomalies).values({
      userId,
      transactionId: a.transactionId,
      kind: a.kind,
      score: a.score,
      reason: a.reason,
      status: 'open',
    }).onConflictDoNothing();
  }

  // Optional Claude narrative
  let monthlyNarrative: { headline: string; body: string } | undefined;
  if (input.withNarrative && env.ANTHROPIC_API_KEY) {
    const narrative = await generateNarrative(
      { currentMonth: isoMonth(), transactions: txns },
      {
        apiKey: env.ANTHROPIC_API_KEY,
        currency,
        formatCurrency: (cents) => formatCurrency(cents, currency),
      },
    );
    monthlyNarrative = { headline: narrative.headline, body: narrative.body };
  }

  // Insight proposals
  await db
    .delete(insights)
    .where(and(eq(insights.userId, userId), sql`${insights.actionTaken} = false`));
  const proposals = generateInsightProposals({
    transactions: txns,
    currentMonth: isoMonth(),
    formatCurrency: (cents) => formatCurrency(cents, currency),
    monthlyNarrative,
  });
  for (const p of proposals) {
    await db.insert(insights).values({
      userId,
      kind: p.kind,
      headline: p.headline,
      body: p.body,
      payload: p.payload as Record<string, unknown>,
      confidence: p.confidence,
      surface: p.surface,
    });
  }

  return {
    insightCount: proposals.length,
    anomalyCount: anomalyProposals.length,
    recurringCount: recurring.length,
  };
}
