import type { Category } from '../categories';
import { matchRule, type Rule } from './rules';
import type { CategorizationResult } from './types';

export interface LlmCategorizer {
  categorize(descriptions: string[]): Promise<Category[]>;
}

export interface OrchestrateOptions {
  rules: Rule[];
  llm: LlmCategorizer | null;
}

export async function categorizeAll(
  descriptions: string[],
  opts: OrchestrateOptions,
): Promise<CategorizationResult[]> {
  const out: (CategorizationResult | null)[] = descriptions.map(() => null);
  const remainder: { idx: number; description: string }[] = [];

  for (let i = 0; i < descriptions.length; i++) {
    const desc = descriptions[i]!;
    const rule = matchRule(desc, opts.rules);
    if (rule) {
      out[i] = {
        category: rule.category,
        source: 'rule',
        confidence: 1,
        reason: `matched ${rule.matchType} rule "${rule.pattern}"`,
      };
    } else {
      remainder.push({ idx: i, description: desc });
    }
  }

  if (remainder.length && opts.llm) {
    const llmCats = await opts.llm.categorize(remainder.map((r) => r.description));
    for (let j = 0; j < remainder.length; j++) {
      out[remainder[j]!.idx] = {
        category: llmCats[j] ?? 'Needs Review',
        source: 'llm',
        confidence: 0.7,
      };
    }
  }

  for (let i = 0; i < out.length; i++) {
    if (!out[i]) {
      out[i] = { category: 'Needs Review', source: 'default', confidence: 0 };
    }
  }

  return out as CategorizationResult[];
}
