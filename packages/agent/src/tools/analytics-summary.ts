import { tool } from 'ai';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { transactions } from '@perfin/db';
import { computeKpis, formatCurrency } from '@perfin/core';
import type { ToolContext } from './types';

const Args = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});

export function analyticsSummary(ctx: ToolContext) {
  return tool({
    description: 'Aggregate income, expenses, savings rate, and top categories for a given month (defaults to current).',
    parameters: Args,
    async execute(args) {
      const month = args.month ?? new Date().toISOString().slice(0, 7);
      const all = await ctx.db
        .select({
          date: transactions.date,
          category: transactions.category,
          amountCents: transactions.amountCents,
        })
        .from(transactions)
        .where(eq(transactions.userId, ctx.userId));

      const kpis = computeKpis({ transactions: all, currentMonth: month });
      const byCat = new Map<string, number>();
      for (const t of all) {
        if (!t.date.startsWith(month)) continue;
        if (t.amountCents >= 0) continue;
        byCat.set(t.category, (byCat.get(t.category) ?? 0) + Math.abs(t.amountCents));
      }
      const topCategories = [...byCat.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category, cents]) => ({
          category,
          spendCents: cents,
          spendFormatted: formatCurrency(cents, ctx.currency),
        }));

      return {
        month,
        incomeCents: kpis.incomeCents,
        incomeFormatted: formatCurrency(kpis.incomeCents, ctx.currency),
        expensesCents: kpis.expensesCents,
        expensesFormatted: formatCurrency(kpis.expensesCents, ctx.currency),
        savingsRate: kpis.savingsRate,
        topCategories,
      };
    },
  });
}
