import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { createDb, insights } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);
  const { id } = await params;
  const insightId = Number(id);

  const body = (await req.json()) as { actionTaken?: boolean };
  await db
    .update(insights)
    .set({ actionTaken: !!body.actionTaken })
    .where(and(eq(insights.id, insightId), eq(insights.userId, userId)));
  return NextResponse.json({ ok: true });
}
