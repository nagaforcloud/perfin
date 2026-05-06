import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { createDb, insights } from '@perfin/db';
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
  const kind = url.searchParams.get('kind');

  const cond = [eq(insights.userId, userId)];
  if (kind) cond.push(eq(insights.kind, kind));

  const rows = await db
    .select()
    .from(insights)
    .where(and(...cond))
    .orderBy(desc(insights.confidence), desc(insights.createdAt))
    .limit(50);

  return NextResponse.json({ rows });
}
