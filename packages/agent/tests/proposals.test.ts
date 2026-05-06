// @ts-nocheck
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDb, users, transactions, agentProposals, type Db } from '@perfin/db';
import { transactionUpdate } from '../src/tools/transaction-update';
import { transactionSplit } from '../src/tools/transaction-split';
import { isProposal } from '../src/tools/types';

const url = process.env.DATABASE_URL ?? 'postgres://perfin:perfin@localhost:5433/perfin';
const skip = process.env.SKIP_DB_TESTS === '1';
let db: Db;
let close: () => Promise<void>;
let userId: number;
let txnId: number;

beforeAll(async () => {
  if (skip) return;
  const created = createDb(url);
  db = created.db;
  close = created.close;
  const [u] = await db.insert(users).values({ email: `agent-pr-${Date.now()}@perfin.dev`, passwordHash: 'x' }).returning();
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

describe.skipIf(skip)('write proposals do not mutate immediately', () => {
  it('transaction.update creates a pending proposal', async () => {
    const tool = transactionUpdate({ userId, db, threadId: null, currency: 'INR' });
    const out = await tool.execute({ id: txnId, category: 'Food' });
    expect(isProposal(out)).toBe(true);
    expect(out.tool).toBe('transaction.update');
    const [props] = await db.select().from(agentProposals).where(eq(agentProposals.id, out.proposalId));
    expect(props?.status).toBe('pending');
    const [txn] = await db.select().from(transactions).where(eq(transactions.id, txnId));
    expect(txn?.category).toBe('Other');
  });

  it('transaction.split creates a pending proposal', async () => {
    const tool = transactionSplit({ userId, db, threadId: null, currency: 'INR' });
    const out = await tool.execute({
      id: txnId,
      splits: [
        { amountCents: -10000, category: 'Food', description: 'lunch portion' },
        { amountCents: -10000, category: 'Groceries', description: 'snack portion' },
      ],
    });
    expect(isProposal(out)).toBe(true);
    expect(out.tool).toBe('transaction.split');
  });

  it('rejects splits that don\'t add up to original amount', async () => {
    const tool = transactionSplit({ userId, db, threadId: null, currency: 'INR' });
    await expect(tool.execute({
      id: txnId,
      splits: [
        { amountCents: -5000, category: 'Food', description: 'partial' },
      ],
    })).rejects.toThrow(/sum/i);
  });
});
