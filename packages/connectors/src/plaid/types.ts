export interface PlaidConfig {
  clientId: string;
  secret: string;
  env: 'sandbox' | 'development' | 'production';
}

export interface SyncResult {
  cursor: string;
  added: PlaidTxn[];
  modified: PlaidTxn[];
  removed: Array<{ transactionId: string }>;
  hasMore: boolean;
}

export interface PlaidTxn {
  transactionId: string;
  accountId: string;
  date: string;
  name: string;
  merchantName?: string | null;
  amount: number;
  pending: boolean;
  category?: string[] | null;
  isoCurrencyCode?: string | null;
}
