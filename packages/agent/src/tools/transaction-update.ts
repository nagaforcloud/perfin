import { tool } from 'ai';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { agentProposals, transactions } from '@perfin/db';
import { CATEGORIES } from '@perfin/core';
import type { ProposalResult, ToolContext } from './types';

const Args = z.object({
  id: z.number().int().positive(),
  category: z.enum(CATEGORIES as readonly [string, ...string[]]).optional(),
  description: z.string().min(1).max(255).optional(),
});

export function transactionUpdate(ctx: ToolContext) {
  return tool({
    description: 'Propose an update to a transaction\'s category or description. Requires user confirmation.',
    parameters: Args,
    async execute(args): Promise<ProposalResult> {
      const [txn] = await ctx.db
        .select()
        .from(transactions)
        .where(and(eq(transactions.id, args.id), eq(transactions.userId, ctx.userId)));
      if (!txn) throw new Error(`transaction ${args.id} not found`);

      const previewParts: string[] = [`Update transaction "${txn.description}" (${txn.date})`];
      if (args.category)    previewParts.push(`category \u2192 ${args.category}`);
      if (args.description) previewParts.push(`description \u2192 "${args.description}"`);
      const preview = previewParts.join(', ');

      const [row] = await ctx.db.insert(agentProposals).values({
        userId: ctx.userId,
        threadId: ctx.threadId,
        tool: 'transaction.update',
        input: args,
        preview,
        status: 'pending',
      }).returning();

      return { kind: 'proposal', proposalId: row!.id, tool: 'transaction.update', preview, args };
    },
  });
}
