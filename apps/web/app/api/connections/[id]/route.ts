import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { createDb, connections } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);
  const { id } = await params;
  await db.update(connections).set({ status: 'disconnected', accessTokenEnc: null }).where(and(eq(connections.id, Number(id)), eq(connections.userId, userId)));
  return NextResponse.json({ ok: true });
}
