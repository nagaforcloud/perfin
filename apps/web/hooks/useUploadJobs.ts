'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export interface UploadJobRow {
  id: number;
  fileName: string;
  mime: string;
  sizeBytes: number;
  status: 'queued' | 'extracting' | 'categorizing' | 'done' | 'failed';
  extractedCount: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  createdAt: string;
}

export function useUploadJobs() {
  return useQuery<{ rows: UploadJobRow[] }>({
    queryKey: ['upload-jobs'],
    queryFn: () => apiFetch<{ rows: UploadJobRow[] }>('/api/upload-jobs'),
  });
}
