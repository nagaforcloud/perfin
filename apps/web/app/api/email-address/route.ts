import { NextResponse } from 'next/server';
import { addressForUser } from '@perfin/connectors';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const address = addressForUser({ userId: Number(userIdStr), secret: env.EMAIL_HASH_SECRET, domain: env.EMAIL_DOMAIN });
  return NextResponse.json({ address, domain: env.EMAIL_DOMAIN });
}
