import { tool } from 'ai';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { recurringSeries } from '@perfin/db';
import { formatCurrency } from '@perfin/core';
import type { ToolContext } from './types';

const Args = z.object({ category: z.string().optional() });

export function recurringDetect(ctx: ToolContext) {
  return tool({
    description: 'List the user\'s detected recurring payments / subscriptions, optionally filtered by category.',
    parameters: Args,
    async execute(args) {
      const rows = await ctx.db.select().from(recurringSeries).where(eq(recurringSeries.userId, ctx.userId));
      const filtered = args.category ? rows.filter((r) => r.category === args.category) : rows;
      return {
        count: filtered.length,
        rows: filtered.map((r) => ({
          merchant: r.merchant,
          category: r.category,
          amountCents: r.amountCents,
          amountFormatted: formatCurrency(r.amountCents, ctx.currency),
          cadence: r.cadence,
          confidence: r.confidence,
          firstSeen: r.firstSeen,
          lastSeen: r.lastSeen,
          nextExpectedAt: r.nextExpectedAt,
        })),
      };
    },
  });
}
