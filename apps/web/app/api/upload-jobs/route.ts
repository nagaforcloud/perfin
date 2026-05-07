import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { createDb, uploadJobs } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);
  const rows = await db.select().from(uploadJobs).where(eq(uploadJobs.userId, userId)).orderBy(desc(uploadJobs.createdAt)).limit(50);
  return NextResponse.json({ rows });
}
