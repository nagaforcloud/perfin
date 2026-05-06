import type { Category } from '../categories';

export interface Rule {
  priority: number;
  matchType: 'contains' | 'exact' | 'regex';
  pattern: string;
  category: Category;
}

export interface CategorizationResult {
  category: Category;
  source: 'rule' | 'llm' | 'default';
  confidence: number;
  reason?: string;
}
