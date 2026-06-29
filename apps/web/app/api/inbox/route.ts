import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { anomalies, transactions } from '@perfin/db';
import { getDb } from '@/lib/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = getDb();
export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = userIdStr;

  const [needsReview, openAnomalies] = await Promise.all([
    db.select().from(transactions).where(and(eq(transactions.userId, userId), eq(transactions.category, 'Needs Review'))).limit(50),
    db.select().from(anomalies).where(and(eq(anomalies.userId, userId), eq(anomalies.status, 'open'))).limit(50),
  ]);

  return NextResponse.json({
    count: needsReview.length + openAnomalies.length,
    needsReview,
    anomalies: openAnomalies,
  });
}
