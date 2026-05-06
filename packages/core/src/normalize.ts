import { rupeesToCents } from './money';
import { hashRow, normalizeDescription } from './text';

export interface RawRow {
  date: string;
  description: string;
  amount: number;
  sourceFile: string | null;
  account?: string | null;
}

export interface NormalizedTxn {
  date: string;
  description: string;
  rawDescription: string;
  amountCents: number;
  sourceFile: string | null;
  account: string | null;
  dedupeHash: string;
}

export interface NormalizeOptions {
  locale?: 'IN' | 'US' | 'EU';
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const SLASH = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
const SHORT = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/;

function pad(n: string): string { return n.padStart(2, '0'); }
function expandYear(y: string): string { return y.length === 2 ? `20${y}` : y; }

export function parseDate(input: string, opts: NormalizeOptions = {}): string {
  const trimmed = input.trim();
  const iso = ISO.exec(trimmed);
  if (iso) return `${iso[1]}-${pad(iso[2]!)}-${pad(iso[3]!)}`;

  const slash = SLASH.exec(trimmed) ?? SHORT.exec(trimmed);
  if (slash) {
    const a = slash[1]!;
    const b = slash[2]!;
    const yRaw = slash[3]!;
    const year = expandYear(yRaw);
    const usFirst = opts.locale === 'US';
    const month = usFirst ? a : b;
    const day = usFirst ? b : a;
    return `${year}-${pad(month)}-${pad(day)}`;
  }
  throw new Error(`unparseable date: ${input}`);
}

export function normalizeRow(raw: RawRow, opts: NormalizeOptions = {}): NormalizedTxn {
  const date = parseDate(raw.date, opts);
  const description = normalizeDescription(raw.description);
  const amountCents = rupeesToCents(raw.amount);
  const sourceFile = raw.sourceFile;
  const dedupeHash = hashRow({ date, description, amountCents, sourceFile });
  return {
    date,
    description,
    rawDescription: raw.description,
    amountCents,
    sourceFile,
    account: raw.account ?? null,
    dedupeHash,
  };
}
