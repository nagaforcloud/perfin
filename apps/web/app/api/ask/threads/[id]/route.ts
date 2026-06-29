import { NextResponse } from 'next/server';
import { and, asc, eq } from 'drizzle-orm';
import { chatMessages, chatThreads } from '@perfin/db';
import { getDb } from '@/lib/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = getDb();
export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = userIdStr;
  const { id } = await params;
  const threadId = Number(id);

  const [thread] = await db.select().from(chatThreads).where(and(eq(chatThreads.id, threadId), eq(chatThreads.userId, userId)));
  if (!thread) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const messages = await db.select().from(chatMessages).where(eq(chatMessages.threadId, threadId)).orderBy(asc(chatMessages.createdAt));
  return NextResponse.json({ thread, messages });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = userIdStr;
  const { id } = await params;
  await db.delete(chatThreads).where(and(eq(chatThreads.id, Number(id)), eq(chatThreads.userId, userId)));
  return NextResponse.json({ ok: true });
}
