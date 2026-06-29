import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { accounts } from '@perfin/db';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';

const { db } = getDb();
export const runtime = 'nodejs';

const AccountCreate = z.object({
  name: z.string().min(1),
  bank: z.string().optional(),
  type: z.enum(['checking', 'savings', 'credit', 'investment', 'cash']).optional(),
  currency: z.string().length(3).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function GET() {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = userIdStr;

  const rows = await db.select().from(accounts).where(eq(accounts.userId, userId)).orderBy(accounts.createdAt);
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = userIdStr;

  const body = AccountCreate.safeParse(await req.json());
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  const { name, bank, type, currency, color } = body.data;

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
