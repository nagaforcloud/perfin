import { tool } from 'ai';
import { z } from 'zod';
import { and, eq, gte } from 'drizzle-orm';
import { transactions } from '@perfin/db';
import { formatCurrency } from '@perfin/core';
import type { ToolContext } from './types';

const Args = z.object({
  days: z.number().int().min(7).max(180).default(30),
});

interface ProjectInput {
  transactions: Array<{ date: string; amountCents: number }>;
  days: number;
  todayIso: string;
}

interface Projection {
  dailyAvgCents: number;
  projectedCents: number;
  startDate: string;
  endDate: string;
}

function project({ transactions: txns, days, todayIso }: ProjectInput): Projection {
  if (!txns.length) return { dailyAvgCents: 0, projectedCents: 0, startDate: todayIso, endDate: todayIso };
  const total = txns.reduce((s, t) => s + t.amountCents, 0);
  const uniqueDays = new Set(txns.map((t) => t.date)).size || 1;
  const dailyAvgCents = Math.round(total / uniqueDays);
  const projectedCents = dailyAvgCents * days;
  const end = new Date(todayIso);
  end.setUTCDate(end.getUTCDate() + days);
  return {
    dailyAvgCents,
    projectedCents,
    startDate: todayIso,
    endDate: end.toISOString().slice(0, 10),
  };
}

export function forecastCashflow(ctx: ToolContext) {
  return tool({
    description: 'Project net cash flow over the next N days using the last 30 days as the baseline.',
    parameters: Args,
    async execute(args) {
      const today = new Date();
      const cutoff = new Date(today);
      cutoff.setUTCDate(cutoff.getUTCDate() - 30);
      const cutoffIso = cutoff.toISOString().slice(0, 10);

      const recent = await ctx.db
        .select({ date: transactions.date, amountCents: transactions.amountCents })
        .from(transactions)
        .where(and(eq(transactions.userId, ctx.userId), gte(transactions.date, cutoffIso)));

      const proj = project({
        transactions: recent,
        days: args.days,
        todayIso: today.toISOString().slice(0, 10),
      });
      return {
        ...proj,
        dailyAvgFormatted: formatCurrency(proj.dailyAvgCents, ctx.currency),
        projectedFormatted: formatCurrency(proj.projectedCents, ctx.currency),
      };
    },
  });
}

export const __test = { project };
