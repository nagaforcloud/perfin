'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface InsightRow {
  id: number;
  kind: 'anomaly' | 'recurring_detected' | 'category_drift' | 'monthly_narrative';
  headline: string;
  body: string;
  payload: Record<string, unknown>;
  confidence: number;
  surface: 'home' | 'insights';
  actionTaken: boolean;
  createdAt: string;
}

export function useInsights(kind?: string) {
  const params = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  return useQuery({
    queryKey: ['insights', kind ?? 'all'],
    queryFn: () => apiFetch<{ rows: InsightRow[] }>(`/api/insights${params}`),
  });
}

export function useDismissInsight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch(`/api/insights/${id}`, { method: 'PATCH', body: JSON.stringify({ actionTaken: true }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insights'] });
      qc.invalidateQueries({ queryKey: ['home'] });
    },
  });
}
