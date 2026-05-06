import { tool } from 'ai';
import { z } from 'zod';
import { agentProposals } from '@perfin/db';
import { CATEGORIES, formatCurrency } from '@perfin/core';
import type { ProposalResult, ToolContext } from './types';

const Args = z.object({
  category: z.enum(CATEGORIES as readonly [string, ...string[]]),
  amountCents: z.number().int().positive(),
  period: z.enum(['monthly', 'quarterly', 'annual']).default('monthly'),
});

export function budgetUpsert(ctx: ToolContext) {
  return tool({
    description: 'Propose creating or updating a spending budget for a category. Requires user confirmation.',
    parameters: Args,
    async execute(args): Promise<ProposalResult> {
      const preview = `Set ${args.period} budget for ${args.category}: ${formatCurrency(args.amountCents, ctx.currency)}`;
      const [row] = await ctx.db.insert(agentProposals).values({
        userId: ctx.userId,
        threadId: ctx.threadId,
        tool: 'budget.upsert',
        input: args,
        preview,
        status: 'pending',
      }).returning();
      return { kind: 'proposal', proposalId: row!.id, tool: 'budget.upsert', preview, args };
    },
  });
}
