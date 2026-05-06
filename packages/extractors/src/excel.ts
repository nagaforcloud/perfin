import * as XLSX from 'xlsx';
import { extractCsv } from './csv';
import type { Extractor, ExtractResult } from './types';

export const extractExcel: Extractor = async ({ buffer, fileName }): Promise<ExtractResult> => {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) return { rows: [], warnings: ['empty workbook'] };
  const sheet = wb.Sheets[firstSheet]!;
  const csv = XLSX.utils.sheet_to_csv(sheet);
  return extractCsv({ buffer: Buffer.from(csv), fileName });
};
