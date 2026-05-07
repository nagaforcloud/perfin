import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseInboundEmail } from '../src/postmark/parse';

const fixture = resolve(__dirname, '../../../data/seeds/hdfc-alert-email.txt');

describe('parseInboundEmail (HDFC)', () => {
  it('extracts amount, date, merchant from HDFC alert', async () => {
    const body = await readFile(fixture, 'utf8');
    const out = parseInboundEmail({ from: 'alerts@hdfcbank.net', subject: 'Debit Alert', body });
    expect(out).not.toBeNull();
    expect(out!.amount).toBe(-450);
    expect(out!.description.toLowerCase()).toContain('swiggy');
    expect(out!.date).toBe('2026-04-15');
    expect(out!.bank).toBe('hdfc');
  });

  it('returns null on unparseable email', () => {
    const out = parseInboundEmail({ from: 'random@x.com', subject: 'Hello', body: 'Hi.' });
    expect(out).toBeNull();
  });
});
