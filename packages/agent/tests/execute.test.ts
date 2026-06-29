// @ts-nocheck
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { createDb, users, transactions, agentProposals, agentActions, budgets, goals, type Db } from '@perfin/db';
import { transactionUpdate } from '../src/tools/transaction-update';
import { budgetUpsert } from '../src/tools/budget-upsert';
import { goalCreate } from '../src/tools/goal-create';
import { executeProposal } from '../src/execute';

const url = process.env.DATABASE_URL ?? 'postgres://perfin:perfin@localhost:5433/perfin';
const skip = process.env.SKIP_DB_TESTS === '1';
let db: Db;
let close: () => Promise<void>;
let userId: string;
let txnId: number;

beforeAll(async () => {
  if (skip) return;
  const created = createDb(url);
  db = created.db;
  close = created.close;
  const [u] = await db.insert(users).values({ email: `agent-ex-${Date.now()}@perfin.dev`, passwordHash: 'x' }).returning();
  userId = u!.id;
  const [t] = await db.insert(transactions).values({
    userId, date: '2026-04-15', description: 'X', rawDescription: 'X', amountCents: -20000, category: 'Other',
  }).returning();
  txnId = t!.id;
});

afterAll(async () => {
  if (skip) return;
  await db.delete(users).where(eq(users.id, userId));
  await close();
});

describe.skipIf(skip)('executeProposal', () => {
  it('applies a transaction.update proposal and writes audit row', async () => {
    const tool = transactionUpdate({ userId, db, threadId: null, currency: 'INR' });
    const proposal = await tool.execute({ id: txnId, category: 'Food' });
    const result = await executeProposal({ db, userId, proposalId: proposal.proposalId });
    expect(result.ok).toBe(true);
    const [t] = await db.select().from(transactions).where(eq(transactions.id, txnId));
    expect(t?.category).toBe('Food');
    const [p] = await db.select().from(agentProposals).where(eq(agentProposals.id, proposal.proposalId));
    expect(p?.status).toBe('confirmed');
    const audit = await db.select().from(agentActions).where(eq(agentActions.userId, userId));
    expect(audit.some((a) => a.tool === 'transaction.update')).toBe(true);
  });

  it('applies a budget.upsert proposal', async () => {
    const tool = budgetUpsert({ userId, db, threadId: null, currency: 'INR' });
    const proposal = await tool.execute({ category: 'Food', amountCents: 50000, period: 'monthly' });
    await executeProposal({ db, userId, proposalId: proposal.proposalId });
    const rows = await db.select().from(budgets).where(eq(budgets.userId, userId));
    expect(rows.find((b) => b.category === 'Food')?.amountCents).toBe(50000);
  });

  it('applies a goal.create proposal', async () => {
    const tool = goalCreate({ userId, db, threadId: null, currency: 'INR' });
    const proposal = await tool.execute({ name: 'Japan trip', targetCents: 500000, deadline: '2026-12-31' });
    await executeProposal({ db, userId, proposalId: proposal.proposalId });
    const rows = await db.select().from(goals).where(eq(goals.userId, userId));
    expect(rows.find((g) => g.name === 'Japan trip')?.targetCents).toBe(500000);
  });

  it('rejects already-cancelled proposals', async () => {
    const tool = budgetUpsert({ userId, db, threadId: null, currency: 'INR' });
    const proposal = await tool.execute({ category: 'Transport', amountCents: 20000, period: 'monthly' });
    // Cancel it first
    await db.update(agentProposals).set({ status: 'cancelled' })
      .where(eq(agentProposals.id, proposal.proposalId));
    // Attempting to execute a cancelled proposal should throw
    await expect(executeProposal({ db, userId, proposalId: proposal.proposalId }))
      .rejects.toThrow(/cancelled/);
  });

  it('rejects non-existent proposals', async () => {
    await expect(executeProposal({ db, userId, proposalId: 999999 }))
      .rejects.toThrow(/not found/);
  });
});
