export type InsightKind =
  | 'anomaly'
  | 'recurring_detected'
  | 'category_drift'
  | 'monthly_narrative';

export interface InsightProposal {
  kind: InsightKind;
  headline: string;
  body: string;
  payload: Record<string, unknown>;
  confidence: number;
  surface: 'home' | 'insights';
}
