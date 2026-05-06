import { describe, expect, it } from 'vitest';
import { detectExtractor } from '../src/detect';
import { extractCsv } from '../src/csv';
import { extractExcel } from '../src/excel';
import { extractPdf } from '../src/pdf';

describe('detectExtractor', () => {
  it('csv by extension', () => {
    expect(detectExtractor({ buffer: Buffer.from(''), fileName: 'a.csv' })).toBe(extractCsv);
  });
  it('xlsx by extension', () => {
    expect(detectExtractor({ buffer: Buffer.from(''), fileName: 'a.xlsx' })).toBe(extractExcel);
  });
  it('pdf by magic bytes', () => {
    expect(detectExtractor({ buffer: Buffer.from('%PDF-1.4'), fileName: 'unknown' })).toBe(extractPdf);
  });
  it('returns null on unknown', () => {
    expect(detectExtractor({ buffer: Buffer.from('???'), fileName: 'a.bin' })).toBe(null);
  });
});
