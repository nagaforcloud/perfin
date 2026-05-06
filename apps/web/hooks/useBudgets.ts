'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface BudgetStatusRow {
  budgetId: number;
  category: string;
  budgetCents: number;
  spentCents: number;
  remainingCents: number;
  percent: number;
  spentFormatted: string;
  budgetFormatted: string;
  remainingFormatted: string;
}

export function useBudgets() {
  return useQuery<{ rows: BudgetStatusRow[] }>({
    queryKey: ['budgets'],
    queryFn: () => apiFetch<{ rows: BudgetStatusRow[] }>('/api/budgets'),
  });
}
