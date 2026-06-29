import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { transactions } from '@perfin/db';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';

const { db } = getDb();
export const runtime = 'nodejs';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = userIdStr;
  const { id } = await params;
  const txnId = Number(id);

  const body = (await req.json()) as { category?: string; description?: string };
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body.category !== undefined) patch.category = body.category;
  if (body.description !== undefined) patch.description = body.description;

  await db.update(transactions)
    .set(patch)
    .where(and(eq(transactions.id, txnId), eq(transactions.userId, userId)));
  return NextResponse.json({ ok: true });
}
