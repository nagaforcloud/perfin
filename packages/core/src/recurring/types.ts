export type Cadence = 'weekly' | 'monthly' | 'quarterly' | 'annual';

export interface RecurringSeriesProposal {
  merchant: string;
  category: string;
  amountCents: number;
  cadence: Cadence;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  nextExpectedAt: string | null;
  confidence: number;
  transactionIds: number[];
}
