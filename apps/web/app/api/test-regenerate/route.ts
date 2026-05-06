import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { callWorker } from '@/lib/worker';

export const runtime = 'nodejs';

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'disabled in production' }, { status: 403 });
  }
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);
  const out = await callWorker<{ ok: true }>('/jobs/regenerate', { userId });
  return NextResponse.json(out);
}
