import { tool } from 'ai';
import { z } from 'zod';
import { agentProposals } from '@perfin/db';
import { formatCurrency } from '@perfin/core';
import type { ProposalResult, ToolContext } from './types';

const Args = z.object({
  name: z.string().min(1).max(120),
  targetCents: z.number().int().positive(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export function goalCreate(ctx: ToolContext) {
  return tool({
    description: 'Propose creating a savings goal with an optional deadline. Requires user confirmation.',
    parameters: Args,
    async execute(args): Promise<ProposalResult> {
      const deadlinePart = args.deadline ? ` by ${args.deadline}` : '';
      const preview = `Create goal "${args.name}": ${formatCurrency(args.targetCents, ctx.currency)}${deadlinePart}`;
      const [row] = await ctx.db.insert(agentProposals).values({
        userId: ctx.userId,
        threadId: ctx.threadId,
        tool: 'goal.create',
        input: args,
        preview,
        status: 'pending',
      }).returning();
      return { kind: 'proposal', proposalId: row!.id, tool: 'goal.create', preview, args };
    },
  });
}
