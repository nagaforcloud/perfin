import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { createDb, budgets, transactions } from '@perfin/db';
import { computeBudgetStatus, formatCurrency } from '@perfin/core';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

const ymNow = () => new Date().toISOString().slice(0, 7);

export async function GET() {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);

  const [bs, txns] = await Promise.all([
    db.select().from(budgets).where(eq(budgets.userId, userId)),
    db.select({ date: transactions.date, category: transactions.category, amountCents: transactions.amountCents })
      .from(transactions).where(eq(transactions.userId, userId)),
  ]);

  const statuses = computeBudgetStatus({
    budgets: bs.map((b) => ({ id: b.id, category: b.category, amountCents: b.amountCents })),
    transactions: txns,
    currentMonth: ymNow(),
  });

  const enriched = statuses.map((s) => ({
    ...s,
    spentFormatted: formatCurrency(s.spentCents, 'INR'),
    budgetFormatted: formatCurrency(s.budgetCents, 'INR'),
    remainingFormatted: formatCurrency(s.remainingCents, 'INR'),
  }));

  return NextResponse.json({ rows: enriched });
}
