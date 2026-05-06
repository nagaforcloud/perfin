import { tool } from 'ai';
import { z } from 'zod';
import { and, desc, eq, gte, ilike, lte, type SQL } from 'drizzle-orm';
import { transactions } from '@perfin/db';
import { formatCurrency } from '@perfin/core';
import type { ToolContext } from './types';

const Args = z.object({
  category: z.string().optional(),
  type: z.enum(['income', 'expense']).optional(),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
});

export function ledgerQuery(ctx: ToolContext) {
  return tool({
    description: 'Query the user\'s transactions with filters. Returns count, total, and top rows.',
    parameters: Args,
    async execute(args) {
      const conds: SQL[] = [eq(transactions.userId, ctx.userId)];
      if (args.category) conds.push(eq(transactions.category, args.category));
      if (args.start)    conds.push(gte(transactions.date, args.start));
      if (args.end)      conds.push(lte(transactions.date, args.end));
      if (args.search)   conds.push(ilike(transactions.description, `%${args.search}%`));

      const all = await ctx.db
        .select()
        .from(transactions)
        .where(and(...conds))
        .orderBy(desc(transactions.date), desc(transactions.id));

      const filtered = args.type
        ? all.filter((t) => (args.type === 'income' ? t.amountCents > 0 : t.amountCents < 0))
        : all;

      const totalCents = filtered.reduce((s, r) => s + r.amountCents, 0);
      return {
        count: filtered.length,
        totalCents,
        totalFormatted: formatCurrency(totalCents, ctx.currency),
        rows: filtered.slice(0, args.limit).map((r) => ({
          id: r.id,
          date: r.date,
          description: r.description,
          category: r.category,
          amountCents: r.amountCents,
          amountFormatted: formatCurrency(r.amountCents, ctx.currency),
        })),
      };
    },
  });
}
