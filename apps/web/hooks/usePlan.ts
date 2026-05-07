'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { Plan } from '@perfin/billing';

export interface PlanStatus {
  plan: Plan;
  subscription: {
    plan: Plan;
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: string;
  } | null;
  hasStripeCustomer: boolean;
}

export function usePlan() {
  return useQuery<PlanStatus>({
    queryKey: ['plan'],
    queryFn: () => apiFetch<PlanStatus>('/api/billing/status'),
    staleTime: 60_000,
  });
}
