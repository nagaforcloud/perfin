import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { createDb, pushSubscriptions } from '@perfin/db';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

const { db } = createDb(env.DATABASE_URL);
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const userId = Number(userIdStr);

  const { endpoint, keys } = (await req.json()) as { endpoint: string; keys: { p256dh: string; auth: string } };
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'invalid push subscription' }, { status: 400 });
  }

  await db.insert(pushSubscriptions).values({
    userId, endpoint, p256dh: keys.p256dh, auth: keys.auth,
  }).onConflictDoNothing({ target: pushSubscriptions.endpoint });

  return NextResponse.json({ ok: true });
}
