import { describe, expect, it } from 'vitest';
import { extractPdf } from '../src/pdf';

describe('extractPdf', () => {
  it('returns structured warning for non-PDF buffer', async () => {
    const out = await extractPdf({ buffer: Buffer.from('not a pdf'), fileName: 'x.pdf' });
    expect(out.rows).toEqual([]);
    expect(out.warnings.length).toBeGreaterThan(0);
  });

  it('returns rows for a real PDF when fixture is available', async () => {
    const path = process.env.PDF_FIXTURE_PATH;
    if (!path) return;
    const { readFile } = await import('node:fs/promises');
    const buffer = await readFile(path);
    const out = await extractPdf({ buffer, fileName: path });
    expect(out.rows.length).toBeGreaterThan(0);
  });
});
