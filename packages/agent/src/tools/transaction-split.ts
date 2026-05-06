import { tool } from 'ai';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { agentProposals, transactions } from '@perfin/db';
import { CATEGORIES, formatCurrency } from '@perfin/core';
import type { ProposalResult, ToolContext } from './types';

const Args = z.object({
  id: z.number().int().positive(),
  splits: z.array(z.object({
    amountCents: z.number().int(),
    category: z.enum(CATEGORIES as readonly [string, ...string[]]),
    description: z.string().min(1).max(255),
  })).min(2),
});

export function transactionSplit(ctx: ToolContext) {
  return tool({
    description: 'Propose splitting a transaction into N child transactions. Splits must sum to the parent amount.',
    parameters: Args,
    async execute(args): Promise<ProposalResult> {
      const [txn] = await ctx.db
        .select()
        .from(transactions)
        .where(and(eq(transactions.id, args.id), eq(transactions.userId, ctx.userId)));
      if (!txn) throw new Error(`transaction ${args.id} not found`);

      const sum = args.splits.reduce((s, p) => s + p.amountCents, 0);
      if (sum !== txn.amountCents) {
        throw new Error(`splits sum to ${sum} but parent is ${txn.amountCents}`);
      }

      const preview = `Split "${txn.description}" (${formatCurrency(txn.amountCents, ctx.currency)}) into ${args.splits.length} parts: `
        + args.splits.map((p) => `${p.category} ${formatCurrency(p.amountCents, ctx.currency)}`).join(', ');

      const [row] = await ctx.db.insert(agentProposals).values({
        userId: ctx.userId,
        threadId: ctx.threadId,
        tool: 'transaction.split',
        input: args,
        preview,
        status: 'pending',
      }).returning();

      return { kind: 'proposal', proposalId: row!.id, tool: 'transaction.split', preview, args };
    },
  });
}
