'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface ThreadRow {
  id: number;
  title: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useThreads() {
  return useQuery<{ rows: ThreadRow[] }>({
    queryKey: ['threads'],
    queryFn: () => apiFetch<{ rows: ThreadRow[] }>('/api/ask/threads'),
  });
}
