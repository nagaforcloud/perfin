import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Compact display: "₹1.42L" / "₹4.2M" — Indian notation */
export function fmt(value: number): string {
  const sign = value < 0 ? '−' : '';
  const abs = Math.abs(value);
  if (abs >= 10_000_000) return `${sign}₹${(abs / 10_000_000).toFixed(2)}Cr`;
  if (abs >= 100_000)    return `${sign}₹${(abs / 100_000).toFixed(2)}L`;
  if (abs >= 1_000)      return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/** Full value with 2 decimals, always positive — pair with sign column */
export function fmtFull(value: number): string {
  return `₹${Math.abs(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Signed long form: "₹1,23,456.78" or "−₹1,23,456.78" */
export function fmtSigned(value: number): string {
  return `${value < 0 ? '−' : ''}₹${Math.abs(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Editorial date: "12 April 2026" */
export function fmtDate(date: string): string {
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Short date: "12 Apr" — used in ledger rows */
export function fmtDateShort(date: string): string {
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

/** Long editorial datestamp: "Saturday · 12 April 2026" */
export function fmtDatestamp(d: Date = new Date()): string {
  const day = d.toLocaleDateString('en-IN', { weekday: 'long' });
  const rest = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  return `${day} · ${rest}`;
}

/** Roman numerals up to 100 — for folio page numbers */
export function roman(num: number): string {
  if (num <= 0) return '—';
  const r: [number, string][] = [
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  for (const [v, s] of r) {
    while (num >= v) { out += s; num -= v; }
  }
  return out;
}

export function dateRange(months?: number, ytd?: boolean): { start_date?: string; end_date?: string } {
  const now = new Date();
  if (!months && !ytd) return {};
  if (ytd) {
    return {
      start_date: `${now.getFullYear()}-01-01`,
      end_date: now.toISOString().slice(0, 10),
    };
  }
  const s = new Date(now);
  s.setMonth(s.getMonth() - months!);
  return {
    start_date: s.toISOString().slice(0, 10),
    end_date: now.toISOString().slice(0, 10),
  };
}

/** Month key for grouping transactions ("Apr 2026") */
export function monthKey(date: string): string {
  return new Date(date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}
