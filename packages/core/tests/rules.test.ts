import { describe, expect, it } from 'vitest';
import { matchRule, type Rule } from '../src/categorize/rules';
import { SEED_RULES } from '../src/categorize/seed-rules';
import { __test as claudeTest } from '../src/categorize/claude';

const rules: Rule[] = [
  { priority: 10, matchType: 'contains', pattern: 'salary', category: 'Income' },
  { priority: 9,  matchType: 'contains', pattern: 'swiggy', category: 'Food' },
  { priority: 5,  matchType: 'regex',    pattern: '^amzn',  category: 'Shopping' },
  { priority: 1,  matchType: 'exact',    pattern: 'rent',   category: 'Rent' },
];

describe('matchRule', () => {
  it('matches by contains, case-insensitive', () => {
    expect(matchRule('SWIGGY Bangalore', rules)?.category).toBe('Food');
  });
  it('matches by regex', () => {
    expect(matchRule('AMZN Mktp US', rules)?.category).toBe('Shopping');
  });
  it('matches by exact', () => {
    expect(matchRule('rent', rules)?.category).toBe('Rent');
    expect(matchRule('rental car', rules)?.category).toBeUndefined();
  });
  it('respects priority — highest wins', () => {
    const overlapping: Rule[] = [
      { priority: 5,  matchType: 'contains', pattern: 'amazon', category: 'Shopping' },
      { priority: 9,  matchType: 'contains', pattern: 'amazon', category: 'Subscription' },
    ];
    expect(matchRule('Amazon Prime', overlapping)?.category).toBe('Subscription');
  });
  it('returns null when nothing matches', () => {
    expect(matchRule('Unknown Vendor 42', rules)).toBeNull();
  });
});

describe('SEED_RULES', () => {
  it('has at least 50 entries', () => {
    expect(SEED_RULES.length).toBeGreaterThanOrEqual(50);
  });
  it('categorizes Swiggy as Food', () => {
    const r = SEED_RULES.find(rr => rr.pattern === 'swiggy');
    expect(r?.category).toBe('Food');
  });
});

describe('Claude response parser', () => {
  it('parses a clean JSON array', () => {
    const out = claudeTest.parseResponse(
      '[{"index":0,"category":"Food"},{"index":1,"category":"Transport"}]',
      2,
    );
    expect(out).toEqual(['Food', 'Transport']);
  });
  it('falls back to Needs Review on invalid category', () => {
    const out = claudeTest.parseResponse('[{"index":0,"category":"Bogus"}]', 1);
    expect(out).toEqual(['Needs Review']);
  });
  it('handles extra prose around JSON', () => {
    const out = claudeTest.parseResponse('Here you go: [{"index":0,"category":"Food"}] cheers', 1);
    expect(out).toEqual(['Food']);
  });
  it('returns all Needs Review when nothing parses', () => {
    expect(claudeTest.parseResponse('not json', 3))
      .toEqual(['Needs Review', 'Needs Review', 'Needs Review']);
  });
});
