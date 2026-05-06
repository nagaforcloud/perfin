export interface KpiInput {
  transactions: Array<{ date: string; category: string; amountCents: number }>;
  currentMonth: string;
}

export interface Kpis {
  incomeCents: number;
  expensesCents: number;
  savingsRate: number;
  topCategory: { name: string; spendCents: number };
}

export function computeKpis(input: KpiInput): Kpis {
  let income = 0;
  let expenses = 0;
  const byCat = new Map<string, number>();
  for (const t of input.transactions) {
    if (!t.date.startsWith(input.currentMonth)) continue;
    if (t.amountCents > 0) income += t.amountCents;
    else {
      const a = Math.abs(t.amountCents);
      expenses += a;
      byCat.set(t.category, (byCat.get(t.category) ?? 0) + a);
    }
  }
  const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    incomeCents: income,
    expensesCents: expenses,
    savingsRate: income > 0 ? (income - expenses) / income : 0,
    topCategory: top ? { name: top[0], spendCents: top[1] } : { name: '\u2014', spendCents: 0 },
  };
}
