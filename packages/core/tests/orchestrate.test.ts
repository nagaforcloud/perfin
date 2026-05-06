import { describe, expect, it, vi } from 'vitest';
import { categorizeAll } from '../src/categorize/orchestrate';
import { SEED_RULES } from '../src/categorize/seed-rules';

describe('categorizeAll', () => {
  it('rule-matches first; calls LLM only for the rest', async () => {
    const llm = { categorize: vi.fn().mockResolvedValue(['Other']) };
    const out = await categorizeAll(
      ['Swiggy Bangalore', 'Some Mystery Vendor'],
      { rules: SEED_RULES, llm },
    );
    expect(out[0]).toEqual({ category: 'Food', source: 'rule', confidence: 1, reason: expect.any(String) });
    expect(out[1]).toEqual({ category: 'Other', source: 'llm', confidence: 0.7 });
    expect(llm.categorize).toHaveBeenCalledTimes(1);
    expect(llm.categorize).toHaveBeenCalledWith(['Some Mystery Vendor']);
  });

  it('falls back to Needs Review if no rule and no LLM', async () => {
    const out = await categorizeAll(['Mystery'], { rules: [], llm: null });
    expect(out[0]).toEqual({ category: 'Needs Review', source: 'default', confidence: 0 });
  });
});
