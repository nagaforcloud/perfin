import { tool } from 'ai';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { anomalies } from '@perfin/db';
import type { ToolContext } from './types';

const Args = z.object({
  status: z.enum(['open', 'confirmed', 'dismissed']).optional(),
});

export function anomaliesList(ctx: ToolContext) {
  return tool({
    description: 'List anomalies (large/unusual transactions). Default status is "open".',
    parameters: Args,
    async execute(args) {
      const status = args.status ?? 'open';
      const rows = await ctx.db
        .select()
        .from(anomalies)
        .where(and(eq(anomalies.userId, ctx.userId), eq(anomalies.status, status)));
      return {
        count: rows.length,
        rows: rows.map((r) => ({
          id: r.id,
          transactionId: r.transactionId,
          kind: r.kind,
          score: r.score,
          reason: r.reason,
        })),
      };
    },
  });
}
