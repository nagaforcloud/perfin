export interface DriftInput {
  transactions: Array<{ id: number; date: string; category: string; amountCents: number; description: string }>;
  currentMonth: string;
  thresholdPct?: number;
}

export interface DriftResult {
  category: string;
  currentSpendCents: number;
  previousSpendCents: number;
  changePct: number;
}

function prevMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

export function detectCategoryDrift(input: DriftInput): DriftResult[] {
  const threshold = input.thresholdPct ?? 20;
  const prev = prevMonth(input.currentMonth);

  const cur = new Map<string, number>();
  const old = new Map<string, number>();
  for (const t of input.transactions) {
    if (t.amountCents >= 0) continue;
    const ym = t.date.slice(0, 7);
    const target = ym === input.currentMonth ? cur : ym === prev ? old : null;
    if (!target) continue;
    target.set(t.category, (target.get(t.category) ?? 0) + Math.abs(t.amountCents));
  }

  const results: DriftResult[] = [];
  for (const [cat, curAmt] of cur) {
    const prevAmt = old.get(cat) ?? 0;
    if (prevAmt === 0) continue;
    const changePct = ((curAmt - prevAmt) / prevAmt) * 100;
    if (Math.abs(changePct) >= threshold) {
      results.push({ category: cat, currentSpendCents: curAmt, previousSpendCents: prevAmt, changePct });
    }
  }
  return results.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));
}
