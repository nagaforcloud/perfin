import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { extractExcel } from '../src/excel';

function makeXlsx(rows: unknown[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('extractExcel', () => {
  it('reads a simple statement sheet', async () => {
    const buffer = makeXlsx([
      ['Date', 'Description', 'Amount'],
      ['2026-04-01', 'Whole Foods', -84.2],
      ['2026-04-02', 'Salary', 6800],
    ]);
    const out = await extractExcel({ buffer, fileName: 't.xlsx' });
    expect(out.rows).toHaveLength(2);
    expect(out.rows[0]?.amount).toBe(-84.2);
  });

  it('handles debit/credit columns', async () => {
    const buffer = makeXlsx([
      ['Date', 'Narration', 'Debit', 'Credit'],
      ['2026-04-01', 'Whole Foods', 84.2, 0],
      ['2026-04-02', 'Salary', 0, 6800],
    ]);
    const out = await extractExcel({ buffer, fileName: 't.xlsx' });
    expect(out.rows[0]?.amount).toBe(-84.2);
    expect(out.rows[1]?.amount).toBe(6800);
  });
});
