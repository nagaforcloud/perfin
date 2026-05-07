import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { createDb, connections } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);
  const rows = await db.select({
    id: connections.id, provider: connections.provider, providerAccountId: connections.providerAccountId,
    status: connections.status, error: connections.error, lastSyncAt: connections.lastSyncAt, createdAt: connections.createdAt,
  }).from(connections).where(eq(connections.userId, userId));
  return NextResponse.json({ rows });
}
