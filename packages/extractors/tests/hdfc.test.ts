import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { detectBank, applyBank } from '../src/banks';

const fixture = (name: string) => resolve(__dirname, 'fixtures', name);

async function loadLines(name: string): Promise<string[]> {
  const text = await readFile(fixture(name), 'utf8');
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

describe('HDFC parser', () => {
  it('detects HDFC from header', async () => {
    const lines = await loadLines('hdfc-sample.txt');
    expect(detectBank(lines)).toBe('hdfc');
  });

  it('applies HDFC parser, signs amounts correctly', async () => {
    const lines = await loadLines('hdfc-sample.txt');
    const out = applyBank(lines, 'apr.pdf', 'hdfc');
    expect(out.bank).toBe('hdfc');
    expect(out.rows).toHaveLength(3);
    expect(out.rows[0]).toMatchObject({ date: '01/04/2026', amount: -450 });
    expect(out.rows[1]).toMatchObject({ date: '02/04/2026', amount: 80000 });
    expect(out.rows[2]).toMatchObject({ date: '03/04/2026', amount: -350 });
  });
});
