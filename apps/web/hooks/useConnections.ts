'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface ConnectionRow {
  id: number;
  provider: string;
  providerAccountId: string | null;
  status: 'active' | 'error' | 'disconnected';
  error: string | null;
  lastSyncAt: string | null;
  createdAt: string;
}

export function useConnections() {
  return useQuery<{ rows: ConnectionRow[] }>({
    queryKey: ['connections'],
    queryFn: () => apiFetch<{ rows: ConnectionRow[] }>('/api/connections'),
  });
}

export function useDisconnectConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch<{ ok: true }>(`/api/connections/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections'] }),
  });
}

export function useSyncConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: number) =>
      apiFetch<{ ok: boolean; added: number; modified: number; removed: number }>(
        '/api/connections/plaid/sync',
        { method: 'POST', body: JSON.stringify({ connectionId }) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['connections'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['home'] });
    },
  });
}
