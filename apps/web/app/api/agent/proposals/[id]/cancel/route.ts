import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { createDb, agentProposals } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);
  const { id } = await params;
  await db.update(agentProposals).set({
    status: 'cancelled',
    cancelledAt: new Date(),
  }).where(and(eq(agentProposals.id, Number(id)), eq(agentProposals.userId, userId), eq(agentProposals.status, 'pending')));
  return NextResponse.json({ ok: true });
}
