'use client';

import { Tile, Skeleton, Badge } from '@perfin/ui';
import { useUploadJobs } from '@/hooks/useUploadJobs';

export function UploadsTab() {
  const { data, isLoading } = useUploadJobs();
  if (isLoading) return <Skeleton variant="tile" />;
  if (!data?.rows.length) return <Tile className="text-text-muted text-center">No uploads yet.</Tile>;
  return (
    <Tile className="px-0 overflow-hidden">
      {data.rows.map((j) => (
        <div key={j.id} className="grid grid-cols-[1fr_120px_140px_100px] items-center gap-3 px-4 py-3 text-sm border-b border-border last:border-0">
          <div className="truncate font-medium">{j.fileName}</div>
          <Badge variant={j.status === 'done' ? 'income' : j.status === 'failed' ? 'expense' : 'info'}>{j.status}</Badge>
          <div className="text-xs text-text-muted">{new Date(j.createdAt).toLocaleString()}</div>
          <div className="text-xs font-mono text-right">{j.extractedCount} txns</div>
        </div>
      ))}
    </Tile>
  );
}
