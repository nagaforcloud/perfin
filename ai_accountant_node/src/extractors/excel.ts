import * as XLSX from 'xlsx';
import type { RawTransaction } from './normalize.js';

const DATE_KEYS = ['transaction date', 'txn date', 'date', 'trans date', 'value date', 'posting date', 'booking date'];
const DESC_KEYS = ['narration', 'description', 'particulars', 'details', 'transaction details', 'payee', 'remarks', 'narrative', 'memo'];
const DEBIT_KEYS = ['withdrawal', 'debit', 'outflow', 'dr amount', 'amount (dr)'];
const CREDIT_KEYS = ['deposit', 'credit', 'inflow', 'cr amount', 'amount (cr)'];
const AMOUNT_KEYS = ['amount', 'transaction amount', 'net amount'];

function findCol(headers: string[], patterns: string[]): number | null {
  const lower = headers.map(h => String(h ?? '').toLowerCase().trim());
  for (const p of patterns) {
    for (let i = 0; i < lower.length; i++) {
      if (lower[i].includes(p)) return i;
    }
  }
  return null;
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/[,\s₹$€£]/g, '').replace(/CR|DR/i, '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function excelDateToString(v: unknown): string {
  if (typeof v === 'number') {
    const date = XLSX.SSF.parse_date_code(v);
    if (date) return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
  }
  return String(v ?? '');
}

export function extractExcel(buffer: Buffer): RawTransaction[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const out: RawTransaction[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true }) as unknown[][];
    if (rows.length < 2) continue;

    let headerIdx = 0;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const joined = rows[i].map(v => String(v ?? '')).join(' ').toLowerCase();
      if (DATE_KEYS.some(k => joined.includes(k))) { headerIdx = i; break; }
    }

    const headers = rows[headerIdx].map(v => String(v ?? ''));
    const dateCol = findCol(headers, DATE_KEYS);
    const descCol = findCol(headers, DESC_KEYS);
    if (dateCol === null || descCol === null) continue;
    const debitCol = findCol(headers, DEBIT_KEYS);
    const creditCol = findCol(headers, CREDIT_KEYS);
    const amountCol = findCol(headers, AMOUNT_KEYS);

    for (const row of rows.slice(headerIdx + 1)) {
      const rawDate = row[dateCol];
      const rawDesc = row[descCol];
      if (rawDate === undefined || rawDate === null || rawDate === '') continue;
      if (rawDesc === undefined || rawDesc === null || String(rawDesc).trim() === '') continue;

      out.push({
        date: excelDateToString(rawDate),
        description: String(rawDesc),
        debit: debitCol !== null ? toNumber(row[debitCol]) : null,
        credit: creditCol !== null ? toNumber(row[creditCol]) : null,
        amount: amountCol !== null ? toNumber(row[amountCol]) : null,
      });
    }
  }
  return out;
}
