export interface BudgetStatusInput {
  budgets: Array<{ id: number; category: string; amountCents: number }>;
  transactions: Array<{ date: string; category: string; amountCents: number }>;
  currentMonth: string;
}

export interface BudgetStatus {
  budgetId: number;
  category: string;
  budgetCents: number;
  spentCents: number;
  remainingCents: number;
  percent: number;
}

export function computeBudgetStatus(input: BudgetStatusInput): BudgetStatus[] {
  const ym = input.currentMonth;
  const spent = new Map<string, number>();
  for (const t of input.transactions) {
    if (t.amountCents >= 0) continue;
    if (!t.date.startsWith(ym)) continue;
    spent.set(t.category, (spent.get(t.category) ?? 0) + Math.abs(t.amountCents));
  }
  return input.budgets.map((b) => {
    const spentCents = spent.get(b.category) ?? 0;
    return {
      budgetId: b.id,
      category: b.category,
      budgetCents: b.amountCents,
      spentCents,
      remainingCents: b.amountCents - spentCents,
      percent: b.amountCents > 0 ? Math.round((spentCents / b.amountCents) * 100) : 0,
    };
  });
}
