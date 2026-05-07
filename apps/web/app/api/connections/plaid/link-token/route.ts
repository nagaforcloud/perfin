import { NextResponse } from 'next/server';
import { createPlaid, createLinkToken } from '@perfin/connectors';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

export async function POST() {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!env.PLAID_CLIENT_ID || !env.PLAID_SECRET) return NextResponse.json({ error: 'Plaid not configured' }, { status: 503 });
  const client = createPlaid({ clientId: env.PLAID_CLIENT_ID, secret: env.PLAID_SECRET, env: env.PLAID_ENV });
  const token = await createLinkToken(client, Number(userIdStr), env.PLAID_WEBHOOK_URL);
  return NextResponse.json({ linkToken: token });
}
