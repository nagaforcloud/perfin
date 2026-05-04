export interface RawTransaction {
  date?: string;
  description?: string;
  debit?: number | null;
  credit?: number | null;
  amount?: number | null;
}

export interface NormalizedTransaction {
  date: string;
  description: string;
  amount: number;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function normalizeDate(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return s;

  const dmy = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(s);
  if (dmy) {
    let [, d, m, y] = dmy;
    if (y.length === 2) y = Number(y) > 50 ? `19${y}` : `20${y}`;
    return `${y}-${pad2(Number(m))}-${pad2(Number(d))}`;
  }

  const ymd = /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/.exec(s);
  if (ymd) return `${ymd[1]}-${pad2(Number(ymd[2]))}-${pad2(Number(ymd[3]))}`;

  const mon = /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})$/.exec(s);
  if (mon) {
    const month = MONTHS[mon[2].toLowerCase()];
    if (month) {
      let y = mon[3];
      if (y.length === 2) y = Number(y) > 50 ? `19${y}` : `20${y}`;
      return `${y}-${pad2(month)}-${pad2(Number(mon[1]))}`;
    }
  }
  return null;
}

export function normalizeBatch(raw: RawTransaction[]): NormalizedTransaction[] {
  const seen = new Set<string>();
  const out: NormalizedTransaction[] = [];

  for (const t of raw) {
    const date = normalizeDate(t.date);
    if (!date) continue;
    const description = (t.description ?? '').trim().replace(/\s+/g, ' ');
    if (!description) continue;

    let amount: number | null = null;
    if (typeof t.amount === 'number' && !Number.isNaN(t.amount)) {
      amount = t.amount;
    } else {
      const debit = typeof t.debit === 'number' && !Number.isNaN(t.debit) ? t.debit : 0;
      const credit = typeof t.credit === 'number' && !Number.isNaN(t.credit) ? t.credit : 0;
      if (debit || credit) amount = credit - debit;
    }
    if (amount === null || amount === 0) continue;

    const sig = `${date}|${description.toLowerCase()}|${Math.round(amount * 100)}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({ date, description, amount });
  }
  return out;
}
