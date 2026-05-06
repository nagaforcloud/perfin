import { NextResponse } from 'next/server';
import { and, desc, eq, gte, ilike, lte } from 'drizzle-orm';
import { createDb, transactions } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);

  const url = new URL(req.url);
  const search = url.searchParams.get('search');
  const category = url.searchParams.get('category');
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');

  const conditions = [eq(transactions.userId, userId)];
  if (category) conditions.push(eq(transactions.category, category));
  if (start) conditions.push(gte(transactions.date, start));
  if (end) conditions.push(lte(transactions.date, end));
  if (search) conditions.push(ilike(transactions.description, `%${search}%`));

  const rows = await db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.date), desc(transactions.id))
    .limit(200);

  return NextResponse.json({ rows });
}
