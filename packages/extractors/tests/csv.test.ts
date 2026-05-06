import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { extractCsv } from '../src/csv';

const fixture = (name: string) => resolve(__dirname, 'fixtures', name);

describe('extractCsv', () => {
  it('parses a simple Date/Description/Amount CSV', async () => {
    const buffer = await readFile(fixture('basic.csv'));
    const out = await extractCsv({ buffer, fileName: 'basic.csv' });
    expect(out.rows).toHaveLength(3);
    expect(out.rows[0]).toMatchObject({
      date: '2026-04-01',
      description: 'Whole Foods Market',
      amount: -84.2,
      sourceFile: 'basic.csv',
    });
    expect(out.rows[1]?.amount).toBe(6800);
  });

  it('detects header columns regardless of case', async () => {
    const buffer = Buffer.from('date,description,amount\n2026-01-01,X,1.50\n');
    const out = await extractCsv({ buffer, fileName: 't.csv' });
    expect(out.rows[0]?.amount).toBe(1.5);
  });

  it('reports a warning when a column is missing', async () => {
    const buffer = Buffer.from('Date,Description\n2026-01-01,X\n');
    const out = await extractCsv({ buffer, fileName: 't.csv' });
    expect(out.warnings.some((w) => /amount/i.test(w))).toBe(true);
    expect(out.rows).toHaveLength(0);
  });
});
