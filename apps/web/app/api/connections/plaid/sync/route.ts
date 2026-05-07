import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { createDb, connections } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';
import { callWorker } from '@/lib/worker';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);
  const { connectionId } = (await req.json()) as { connectionId: number };
  const [conn] = await db.select().from(connections).where(and(eq(connections.id, connectionId), eq(connections.userId, userId)));
  if (!conn) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const out = await callWorker<{ ok: boolean; added: number; modified: number; removed: number }>('/jobs/plaid-sync', { connectionId });
  return NextResponse.json(out);
}
