const BANK_PREFIX_PATTERNS = [
  /^UPI\/[^\/]+\//i,
  /^POS\s+X{2,}\d+\s+/i,
  /^NEFT-/i,
  /^IMPS-/i,
  /^ATM\s+WD\s+/i,
];

const TRAILING_CODE = /\s+[A-Z0-9]{6,}$/;

export function normalizeDescription(raw: string): string {
  let s = raw.trim().replace(/\s+/g, ' ');
  for (const pattern of BANK_PREFIX_PATTERNS) {
    s = s.replace(pattern, '');
  }
  s = s.replace(TRAILING_CODE, '');
  return s.trim();
}

export interface HashRowInput {
  date: string;
  description: string;
  amountCents: number;
  sourceFile: string | null;
}

/**
 * Simple FNV-1a-like hash for deduplication (not cryptographic).
 * Pure TS — safe for both browser and Node.
 */
export function hashRow(row: HashRowInput): string {
  const key = `${row.date}|${row.description}|${row.amountCents}|${row.sourceFile ?? ''}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
