import type { Rule } from './types';

export type { Rule };

export function matchRule(description: string, rules: Rule[]): Rule | null {
  const desc = description.toLowerCase();
  const sorted = [...rules].sort((a, b) => b.priority - a.priority);
  for (const r of sorted) {
    const p = r.pattern.toLowerCase();
    if (r.matchType === 'contains' && desc.includes(p)) return r;
    if (r.matchType === 'exact'    && desc === p)        return r;
    if (r.matchType === 'regex') {
      try {
        if (new RegExp(r.pattern, 'i').test(description)) return r;
      } catch {
        // skip invalid regex
      }
    }
  }
  return null;
}
