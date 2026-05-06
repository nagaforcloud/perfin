'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface AgentAction {
  id: number;
  tool: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  createdAt: string;
  confirmedAt: string | null;
}

export function useActivity() {
  return useQuery<{ rows: AgentAction[] }>({
    queryKey: ['agent-activity'],
    queryFn: () => apiFetch<{ rows: AgentAction[] }>('/api/agent/activity'),
  });
}
