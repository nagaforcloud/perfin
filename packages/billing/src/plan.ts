export type Plan = 'free' | 'plus' | 'pro';

export const FEATURES = {
  PLAID_CONNECTIONS: 'plaid_connections',
  UNLIMITED_TXNS:    'unlimited_txns',
  EXCEL_EXPORT:      'excel_export',
  AGENT_BASIC:       'agent_basic',
  AGENT_GEN:         'agent_generous',
  UNLIMITED_AGENT:   'unlimited_agent',
  MEMBERS:           'members',
  PDF_REPORT:        'pdf_report',
} as const;

export type Feature = typeof FEATURES[keyof typeof FEATURES];

const featureMatrix: Record<Feature, Plan[]> = {
  plaid_connections: ['plus', 'pro'],
  unlimited_txns:    ['plus', 'pro'],
  excel_export:      ['plus', 'pro'],
  agent_basic:       ['free', 'plus', 'pro'],
  agent_generous:    ['plus', 'pro'],
  unlimited_agent:   ['pro'],
  members:           ['pro'],
  pdf_report:        ['pro'],
};

export function hasFeature(plan: Plan, feature: Feature): boolean {
  return featureMatrix[feature].includes(plan);
}

export function isPlus(plan: Plan): boolean {
  return plan === 'plus' || plan === 'pro';
}

export function isPro(plan: Plan): boolean {
  return plan === 'pro';
}

export interface PriceMap {
  plus: string;
  pro: string;
}

export function planForPriceId(priceId: string, prices: PriceMap): Plan | null {
  if (priceId === prices.plus) return 'plus';
  if (priceId === prices.pro)  return 'pro';
  return null;
}
