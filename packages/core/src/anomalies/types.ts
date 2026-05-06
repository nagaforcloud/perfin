export type AnomalyKind = 'large_amount' | 'rare_merchant' | 'category_outlier' | 'duplicate_suspect';

export interface AnomalyProposal {
  transactionId: number;
  kind: AnomalyKind;
  score: number;
  reason: string;
}
