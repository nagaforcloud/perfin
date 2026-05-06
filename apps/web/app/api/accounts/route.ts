import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { createDb, accounts } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);

  const rows = await db.select().from(accounts).where(eq(accounts.userId, userId)).orderBy(accounts.createdAt);
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);

  const body = (await req.json()) as { name: string; bank?: string; type?: string; currency?: string; color?: string };
  if (!body.name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const [row] = await db.insert(accounts).values({
    userId,
    name: body.name,
    bank: body.bank ?? '',
    type: body.type ?? 'checking',
    currency: body.currency ?? 'INR',
    color: body.color ?? '#6366f1',
  }).returning();
  return NextResponse.json({ row });
}
