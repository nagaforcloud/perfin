'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export function useEmailAddress() {
  return useQuery<{ address: string; domain: string }>({
    queryKey: ['email-address'],
    queryFn: () => apiFetch<{ address: string; domain: string }>('/api/email-address'),
  });
}
