import { parse } from 'csv-parse/sync';
import type { RawTransaction } from './normalize.js';

const DATE_KEYS = ['transaction date', 'txn date', 'date', 'trans date', 'value date', 'posting date', 'booking date'];
const DESC_KEYS = ['narration', 'description', 'particulars', 'details', 'transaction details', 'payee', 'remarks', 'narrative', 'transaction description', 'memo'];
const DEBIT_KEYS = ['withdrawal', 'debit', 'debit amount', 'withdrawal amt', 'outflow', 'amount (dr)', 'dr amount', 'amount dr'];
const CREDIT_KEYS = ['deposit', 'credit', 'credit amount', 'deposit amt', 'inflow', 'amount (cr)', 'cr amount', 'amount cr'];
const AMOUNT_KEYS = ['amount', 'transaction amount', 'net amount', 'txn amount'];

function findCol(headers: string[], patterns: string[]): number | null {
  const lower = headers.map(h => h.toLowerCase().trim());
  for (const p of patterns) {
    for (let i = 0; i < lower.length; i++) {
      if (lower[i].includes(p)) return i;
    }
  }
  return null;
}

function parseMoney(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/[,\s₹$€£]/g, '').replace(/CR|DR/i, '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function extractCsv(buffer: Buffer): RawTransaction[] {
  const rows = parse(buffer, {
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
  }) as string[][];

  if (rows.length < 2) return [];

  let headerIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const joined = rows[i].join(' ').toLowerCase();
    if (DATE_KEYS.some(k => joined.includes(k))) { headerIdx = i; break; }
  }

  const headers = rows[headerIdx];
  const body = rows.slice(headerIdx + 1);

  const dateCol = findCol(headers, DATE_KEYS);
  const descCol = findCol(headers, DESC_KEYS);
  const debitCol = findCol(headers, DEBIT_KEYS);
  const creditCol = findCol(headers, CREDIT_KEYS);
  const amountCol = findCol(headers, AMOUNT_KEYS);

  if (dateCol === null || descCol === null) return [];

  const out: RawTransaction[] = [];
  for (const row of body) {
    const date = row[dateCol];
    const description = row[descCol];
    if (!date || !description) continue;

    const debit = debitCol !== null ? parseMoney(row[debitCol]) : null;
    const credit = creditCol !== null ? parseMoney(row[creditCol]) : null;
    const amount = amountCol !== null ? parseMoney(row[amountCol]) : null;

    out.push({ date, description, debit, credit, amount });
  }
  return out;
}
