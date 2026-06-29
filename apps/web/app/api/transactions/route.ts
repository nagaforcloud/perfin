import { NextResponse } from 'next/server';
import { and, desc, eq, gte, ilike, lte, asc, sql } from 'drizzle-orm';
import { transactions } from '@perfin/db';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';

const { db } = getDb();
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = userIdStr;

  const url = new URL(req.url);
  const search = url.searchParams.get('search');
  const category = url.searchParams.get('category');
  const start = url.searchParams.get('start');
  const end = url.searchParams.get('end');
  const sortBy = url.searchParams.get('sortBy') || 'date';
  const sortDir = url.searchParams.get('sortDir') || 'desc';
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 50));

  const conditions = [eq(transactions.userId, userId)];
  if (category) conditions.push(eq(transactions.category, category));
  if (start) conditions.push(gte(transactions.date, start));
  if (end) conditions.push(lte(transactions.date, end));
  if (search) conditions.push(ilike(transactions.description, `%${search}%`));

  // Build order
  const sortCol = sortBy === 'description' ? transactions.description
    : sortBy === 'amountCents' ? transactions.amountCents
    : transactions.date;
  const orderFn = sortDir === 'asc' ? asc : desc;
  const orderBy = [orderFn(sortCol), desc(transactions.id)];

  const [rows, [countRow]] = await Promise.all([
    db.select().from(transactions).where(and(...conditions)).orderBy(...orderBy).limit(limit).offset(offset),
    db.select({ total: sql<number>`count(*)` }).from(transactions).where(and(...conditions)),
  ]);

  const total = Number(countRow?.total ?? 0);

  return NextResponse.json({ rows, total });
}
