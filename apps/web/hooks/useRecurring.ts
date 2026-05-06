'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface RecurringRow {
  id: number;
  merchant: string;
  category: string;
  amountCents: number;
  amountFormatted: string;
  cadence: 'weekly' | 'monthly' | 'quarterly' | 'annual';
  nextExpectedAt: string | null;
  confidence: number;
  firstSeen: string;
  lastSeen: string;
}

export function useRecurring() {
  return useQuery<{ rows: RecurringRow[] }>({
    queryKey: ['recurring'],
    queryFn: () => apiFetch<{ rows: RecurringRow[] }>('/api/recurring'),
  });
}
