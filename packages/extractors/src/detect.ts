import type { Extractor, ExtractInput } from './types';
import { extractCsv } from './csv';
import { extractExcel } from './excel';
import { extractPdf } from './pdf';

export function detectExtractor(input: ExtractInput): Extractor | null {
  const lower = input.fileName.toLowerCase();
  if (lower.endsWith('.csv')) return extractCsv;
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return extractExcel;
  if (lower.endsWith('.pdf')) return extractPdf;

  if (input.buffer.subarray(0, 4).toString('ascii') === '%PDF') return extractPdf;
  if (input.buffer.subarray(0, 2).toString('hex') === '504b') return extractExcel;
  return null;
}
