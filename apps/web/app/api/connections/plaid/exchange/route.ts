import { NextResponse } from 'next/server';
import { connections } from '@perfin/db';
import { getDb } from '@/lib/db';
import { createPlaid, encryptString, exchangePublicToken } from '@perfin/connectors';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';
import { callWorker } from '@/lib/worker';

const { db } = getDb();
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await auth();
  const userIdStr = session?.user && 'id' in session.user ? (session.user as { id?: string }).id : undefined;
  if (!userIdStr) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!env.PLAID_CLIENT_ID || !env.PLAID_SECRET || !env.KMS_KEY) return NextResponse.json({ error: 'Plaid/KMS not configured' }, { status: 503 });
  const userId = userIdStr;
  const { publicToken } = (await req.json()) as { publicToken: string };
  if (!publicToken) return NextResponse.json({ error: 'publicToken required' }, { status: 400 });

  const client = createPlaid({ clientId: env.PLAID_CLIENT_ID, secret: env.PLAID_SECRET, env: env.PLAID_ENV });
  const { accessToken, itemId } = await exchangePublicToken(client, publicToken);
  const accessTokenEnc = encryptString(env.KMS_KEY, accessToken);

  const [conn] = await db.insert(connections).values({
    userId, provider: 'plaid', providerAccountId: itemId, accessTokenEnc, status: 'active',
  }).returning();

  if (conn) {
    callWorker('/jobs/plaid-sync', { connectionId: conn.id }).catch((err) => { console.error('initial plaid sync failed', err); });
  }
  return NextResponse.json({ connectionId: conn?.id });
}
