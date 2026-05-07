import type { PlaidApi, TransactionsSyncRequest } from 'plaid';
import type { PlaidTxn, SyncResult } from './types';

export interface SyncInput {
  client: PlaidApi;
  accessToken: string;
  cursor: string | null;
}

export async function syncTransactions(input: SyncInput): Promise<SyncResult> {
  const added: PlaidTxn[] = [];
  const modified: PlaidTxn[] = [];
  const removed: Array<{ transactionId: string }> = [];
  let cursor = input.cursor ?? null;
  let hasMore = true;

  while (hasMore) {
    const req = {
      access_token: input.accessToken,
      ...(cursor != null ? { cursor } : {}),
    } as TransactionsSyncRequest;
    const res = await input.client.transactionsSync(req);
    const data = res.data;
    for (const t of data.added)    added.push(toTxn(t));
    for (const t of data.modified) modified.push(toTxn(t));
    for (const r of data.removed)  removed.push({ transactionId: r.transaction_id ?? '' });
    cursor = data.next_cursor;
    hasMore = data.has_more;
  }

  return { cursor: cursor ?? '', added, modified, removed, hasMore: false };
}

function toTxn(t: {
  transaction_id: string; account_id: string; date: string; name: string;
  merchant_name?: string | null; amount: number; pending: boolean;
  category?: string[] | null; iso_currency_code?: string | null;
}): PlaidTxn {
  return {
    transactionId: t.transaction_id,
    accountId: t.account_id,
    date: t.date,
    name: t.name,
    merchantName: t.merchant_name ?? null,
    amount: t.amount,
    pending: t.pending,
    category: t.category ?? null,
    isoCurrencyCode: t.iso_currency_code ?? null,
  };
}
