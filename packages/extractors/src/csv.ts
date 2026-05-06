import { parse } from 'csv-parse/sync';
import type { Extractor, ExtractResult } from './types';

const DATE_KEYS        = ['date', 'transaction date', 'txn date', 'posted'];
const DESC_KEYS        = ['description', 'narration', 'particulars', 'details', 'memo'];
const AMOUNT_KEYS      = ['amount', 'amt', 'value'];
const DEBIT_KEYS       = ['debit', 'withdrawal'];
const CREDIT_KEYS      = ['credit', 'deposit'];

function findKey(header: string[], candidates: string[]): string | null {
  for (const c of candidates) {
    const found = header.find((h) => h.toLowerCase().trim() === c);
    if (found) return found;
  }
  return null;
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[,\s₹$€£]/g, '').replace(/\((.*)\)/, '-$1');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

export const extractCsv: Extractor = async ({ buffer, fileName }): Promise<ExtractResult> => {
  const records = parse(buffer, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  const warnings: string[] = [];
  if (!records.length) return { rows: [], warnings: ['empty CSV'] };

  const header = Object.keys(records[0]!);
  const dateKey = findKey(header, DATE_KEYS);
  const descKey = findKey(header, DESC_KEYS);
  const amountKey = findKey(header, AMOUNT_KEYS);
  const debitKey  = findKey(header, DEBIT_KEYS);
  const creditKey = findKey(header, CREDIT_KEYS);

  if (!dateKey) { warnings.push('no date column found'); return { rows: [], warnings }; }
  if (!descKey) { warnings.push('no description column found'); return { rows: [], warnings }; }
  if (!amountKey && !debitKey && !creditKey) {
    warnings.push('no amount/debit/credit column found');
    return { rows: [], warnings };
  }

  const rows = records
    .map((r) => {
      const date = r[dateKey] ?? '';
      const description = r[descKey] ?? '';
      let amount: number;
      if (amountKey) {
        amount = parseAmount(r[amountKey] ?? '');
      } else {
        const debit  = debitKey  ? parseAmount(r[debitKey]  ?? '0') : 0;
        const credit = creditKey ? parseAmount(r[creditKey] ?? '0') : 0;
        amount = (Number.isFinite(credit) ? credit : 0) - (Number.isFinite(debit) ? debit : 0);
      }
      if (!Number.isFinite(amount)) return null;
      return { date, description, amount, sourceFile: fileName, account: null };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return { rows, warnings };
};
