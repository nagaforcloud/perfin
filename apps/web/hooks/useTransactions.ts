'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { Transaction } from '@perfin/db';

export interface TxnFilters {
  search?: string;
  category?: string;
  start?: string;
  end?: string;
}

export function useTransactions(filters: TxnFilters = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => apiFetch<{ rows: Transaction[] }>(`/api/transactions?${params}`),
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: { category?: string; description?: string } }) =>
      apiFetch<{ ok: true }>(`/api/transactions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}
