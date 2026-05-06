'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface HomeData {
  currency: string;
  netWorthCents: number;
  netWorthFormatted: string;
  sparkline90d: number[];
  kpis: {
    incomeCents: number; incomeFormatted: string;
    expensesCents: number; expensesFormatted: string;
    savingsRate: number;
    topCategory: { name: string; spendCents: number; formatted: string };
  };
  todayInsight: { id: number; headline: string; body: string; kind: string; payload: Record<string, unknown> } | null;
  recent: Array<{ id: number; date: string; description: string; category: string; amountCents: number; amountFormatted: string }>;
}

export function useHome() {
  return useQuery<HomeData>({
    queryKey: ['home'],
    queryFn: () => apiFetch<HomeData>('/api/home'),
  });
}
