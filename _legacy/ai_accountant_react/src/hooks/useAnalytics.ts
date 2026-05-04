import { useQuery } from '@tanstack/react-query';
import { Analytics } from '@/api/client';
import type { DateRangeParams } from '@/lib/types';

export function useDashboard(params: DateRangeParams = {}) {
  return useQuery({
    queryKey: ['dashboard', 'summary', params],
    queryFn: () => Analytics.summary(params),
  });
}

export function useMonthly(params: DateRangeParams = {}) {
  return useQuery({
    queryKey: ['analytics', 'monthly', params],
    queryFn: () => Analytics.monthly(params),
  });
}

export function useCategories(params: DateRangeParams = {}) {
  return useQuery({
    queryKey: ['analytics', 'categories', params],
    queryFn: () => Analytics.categories(params),
  });
}

export function useMerchants(params: DateRangeParams & { top?: number } = {}) {
  return useQuery({
    queryKey: ['analytics', 'merchants', params],
    queryFn: () => Analytics.merchants(params),
  });
}

export function useHealth() {
  return useQuery({ queryKey: ['analytics', 'health'], queryFn: Analytics.health });
}

export function useAnomalies(params: DateRangeParams = {}) {
  return useQuery({
    queryKey: ['analytics', 'anomalies', params],
    queryFn: () => Analytics.anomalies(params),
  });
}

export function useRecurring() {
  return useQuery({ queryKey: ['analytics', 'recurring'], queryFn: Analytics.recurring });
}

export function useBudgets(params: DateRangeParams = {}) {
  return useQuery({
    queryKey: ['analytics', 'budgets', params],
    queryFn: () => Analytics.budgets(params),
  });
}
