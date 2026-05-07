import { and, eq } from 'drizzle-orm';
import { connections, accounts as accountsTbl, transactions as txnsTbl, type Db } from '@perfin/db';
import {
  createPlaid, decryptString, syncTransactions,
  type PlaidConfig, type PlaidTxn,
} from '@perfin/connectors';
import { env } from '../env.js';

export interface PlaidSyncInput {
  db: Db;
  connectionId: number;
}

export interface PlaidSyncOutput {
  added: number;
  modified: number;
  removed: number;
}

export async function syncOnePlaidConnection(input: PlaidSyncInput): Promise<PlaidSyncOutput> {
  const { db, connectionId } = input;

  const [conn] = await db.select().from(connections).where(eq(connections.id, connectionId));
  if (!conn) throw new Error(`connection ${connectionId} not found`);
  if (conn.provider !== 'plaid') throw new Error(`connection ${connectionId} is not plaid`);
  if (!conn.accessTokenEnc) throw new Error('no access token stored');
  if (!env.KMS_KEY) throw new Error('KMS_KEY not configured');
  if (!env.PLAID_CLIENT_ID || !env.PLAID_SECRET) throw new Error('Plaid not configured');

  const accessToken = decryptString(env.KMS_KEY, conn.accessTokenEnc);
  const plaidConfig: PlaidConfig = {
    clientId: env.PLAID_CLIENT_ID,
    secret: env.PLAID_SECRET,
    env: env.PLAID_ENV,
  };
  const client = createPlaid(plaidConfig);

  const result = await syncTransactions({ client, accessToken, cursor: conn.cursor });

  const allChanged: PlaidTxn[] = [...result.added, ...result.modified];
  for (const t of allChanged) {
    let [acct] = await db
      .select()
      .from(accountsTbl)
      .where(and(eq(accountsTbl.userId, conn.userId), eq(accountsTbl.plaidAccountId, t.accountId)));
    if (!acct) {
      const [created] = await db.insert(accountsTbl).values({
        userId: conn.userId,
        connectionId: conn.id,
        plaidAccountId: t.accountId,
        name: 'Plaid account',
        bank: '',
        type: 'checking',
        currency: t.isoCurrencyCode ?? 'USD',
      }).returning();
      acct = created!;
    }

    await db.insert(txnsTbl).values({
      userId: conn.userId,
      accountId: acct.id,
      date: t.date,
      description: t.merchantName ?? t.name,
      rawDescription: t.name,
      amountCents: Math.round(-t.amount * 100),
      category: 'Needs Review',
      pending: t.pending,
      plaidTxnId: t.transactionId,
    }).onConflictDoNothing();
  }

  for (const r of result.removed) {
    await db.delete(txnsTbl).where(and(
      eq(txnsTbl.userId, conn.userId),
      eq(txnsTbl.plaidTxnId, r.transactionId),
    ));
  }

  await db.update(connections).set({
    cursor: result.cursor,
    lastSyncAt: new Date(),
    status: 'active',
    error: null,
  }).where(eq(connections.id, connectionId));

  return {
    added: result.added.length,
    modified: result.modified.length,
    removed: result.removed.length,
  };
}
