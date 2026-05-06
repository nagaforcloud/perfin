'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

interface InboxData {
  count: number;
  needsReview: Array<{ id: number; date: string; description: string; amountCents: number; category: string }>;
  anomalies: Array<{ id: number; transactionId: number; kind: string; reason: string; score: number }>;
}

export function useInbox() {
  return useQuery<InboxData>({
    queryKey: ['inbox'],
    queryFn: () => apiFetch<InboxData>('/api/inbox'),
    refetchInterval: 30_000,
  });
}
