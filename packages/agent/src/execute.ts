import { and, eq } from 'drizzle-orm';
import {
  agentActions, agentProposals, budgets, goals, transactions, type Db,
} from '@perfin/db';

export interface ExecuteInput {
  db: Db;
  userId: number;
  proposalId: number;
}

export interface ExecuteOutput {
  ok: boolean;
  output: unknown;
}

export async function executeProposal({ db, userId, proposalId }: ExecuteInput): Promise<ExecuteOutput> {
  const [proposal] = await db
    .select()
    .from(agentProposals)
    .where(and(eq(agentProposals.id, proposalId), eq(agentProposals.userId, userId)));
  if (!proposal) throw new Error(`proposal ${proposalId} not found`);
  if (proposal.status !== 'pending') throw new Error(`proposal ${proposalId} is ${proposal.status}`);

  let output: unknown;
  switch (proposal.tool) {
    case 'transaction.update':
      output = await applyTransactionUpdate(db, userId, proposal.input as { id: number; category?: string; description?: string });
      break;
    case 'transaction.split':
      output = await applyTransactionSplit(db, userId, proposal.input as { id: number; splits: Array<{ amountCents: number; category: string; description: string }> });
      break;
    case 'budget.upsert':
      output = await applyBudgetUpsert(db, userId, proposal.input as { category: string; amountCents: number; period: 'monthly' | 'quarterly' | 'annual' });
      break;
    case 'goal.create':
      output = await applyGoalCreate(db, userId, proposal.input as { name: string; targetCents: number; deadline?: string });
      break;
    default:
      throw new Error(`unknown tool: ${proposal.tool}`);
  }

  await db.update(agentProposals).set({
    status: 'confirmed',
    confirmedAt: new Date(),
    output: output as Record<string, unknown>,
  }).where(eq(agentProposals.id, proposalId));

  await db.insert(agentActions).values({
    userId,
    tool: proposal.tool,
    input: proposal.input,
    output: output as Record<string, unknown>,
    confirmedBy: userId,
    confirmedAt: new Date(),
  });

  return { ok: true, output };
}

async function applyTransactionUpdate(
  db: Db, userId: number,
  input: { id: number; category?: string; description?: string },
) {
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.category)    patch.category = input.category;
  if (input.description) patch.description = input.description;
  await db.update(transactions).set(patch).where(and(eq(transactions.id, input.id), eq(transactions.userId, userId)));
  return { id: input.id, ...patch };
}

async function applyTransactionSplit(
  db: Db, userId: number,
  input: { id: number; splits: Array<{ amountCents: number; category: string; description: string }> },
) {
  const [parent] = await db.select().from(transactions).where(and(eq(transactions.id, input.id), eq(transactions.userId, userId)));
  if (!parent) throw new Error('parent transaction not found');
  const childIds: number[] = [];
  for (const s of input.splits) {
    const [child] = await db.insert(transactions).values({
      userId,
      accountId: parent.accountId,
      date: parent.date,
      description: s.description,
      rawDescription: parent.rawDescription,
      amountCents: s.amountCents,
      category: s.category,
      sourceFile: parent.sourceFile,
      parentTransactionId: parent.id,
    }).returning({ id: transactions.id });
    if (child) childIds.push(child.id);
  }
  return { parentId: input.id, childIds };
}

async function applyBudgetUpsert(
  db: Db, userId: number,
  input: { category: string; amountCents: number; period: 'monthly' | 'quarterly' | 'annual' },
) {
  const [row] = await db.insert(budgets)
    .values({ userId, category: input.category, amountCents: input.amountCents, period: input.period })
    .returning();
  return row;
}

async function applyGoalCreate(
  db: Db, userId: number,
  input: { name: string; targetCents: number; deadline?: string },
) {
  const [row] = await db.insert(goals).values({
    userId, name: input.name, targetCents: input.targetCents, deadline: input.deadline ?? null,
  }).returning();
  return row;
}
