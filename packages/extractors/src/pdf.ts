import type { Extractor, ExtractResult } from './types';
import { detectBank, applyBank } from './banks/index';

export const extractPdf: Extractor = async ({ buffer, fileName, password }): Promise<ExtractResult> => {
  const warnings: string[] = [];
  let lines: string[] = [];

  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs') as typeof import('pdfjs-dist');
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      password,
      isEvalSupported: false,
      useSystemFonts: true,
    });
    const doc = await loadingTask.promise;
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const lineMap = new Map<number, string[]>();
      for (const item of content.items as Array<{ str: string; transform: number[] }>) {
        const y = Math.round(item.transform[5]!);
        const existing = lineMap.get(y) ?? [];
        existing.push(item.str);
        lineMap.set(y, existing);
      }
      const sorted = Array.from(lineMap.entries()).sort(([a], [b]) => b - a);
      for (const [, parts] of sorted) {
        const line = parts.join(' ').replace(/\s+/g, ' ').trim();
        if (line) lines.push(line);
      }
    }
  } catch (err) {
    warnings.push(`PDF parse error: ${err instanceof Error ? err.message : String(err)}`);
    return { rows: [], warnings };
  }

  if (!lines.length) {
    warnings.push('no text in PDF (possibly scanned image — OCR not implemented yet)');
    return { rows: [], warnings };
  }

  const bank = detectBank(lines);
  const result = applyBank(lines, fileName, bank);
  return { rows: result.rows, bank: result.bank, warnings: [...warnings, ...result.warnings] };
};
