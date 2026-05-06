import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { createDb, transactions, insights, accounts } from '@perfin/db';
import { computeKpis, formatCurrency } from '@perfin/core';
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

  const [allTxns, recent, todayInsights, accs] = await Promise.all([
    db.select({
      id: transactions.id,
      date: transactions.date,
      description: transactions.description,
      amountCents: transactions.amountCents,
      category: transactions.category,
    }).from(transactions).where(eq(transactions.userId, userId)),
    db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.date), desc(transactions.id)).limit(8),
    db.select().from(insights).where(and(eq(insights.userId, userId), eq(insights.surface, 'home'))).orderBy(desc(insights.confidence)).limit(1),
    db.select().from(accounts).where(eq(accounts.userId, userId)),
  ]);

  const kpis = computeKpis({ transactions: allTxns, currentMonth: ymNow() });
  const currency = accs[0]?.currency ?? 'INR';

  const sorted = [...allTxns].sort((a, b) => a.date.localeCompare(b.date));
  let running = 0;
  const series = sorted.map((t) => {
    running += t.amountCents;
    return { date: t.date, balanceCents: running };
  });
  const last90 = series.slice(-90).map((s) => s.balanceCents);

  const netWorthCents = accs.reduce((sum, a) => sum + a.balanceCents, 0) || running;

  return NextResponse.json({
    currency,
    netWorthCents,
    netWorthFormatted: formatCurrency(netWorthCents, currency),
    sparkline90d: last90,
    kpis: {
      ...kpis,
      incomeFormatted: formatCurrency(kpis.incomeCents, currency),
      expensesFormatted: formatCurrency(kpis.expensesCents, currency),
      topCategory: { ...kpis.topCategory, formatted: formatCurrency(kpis.topCategory.spendCents, currency) },
    },
    todayInsight: todayInsights[0] ?? null,
    recent: recent.map((r) => ({ ...r, amountFormatted: formatCurrency(r.amountCents, currency) })),
  });
}
