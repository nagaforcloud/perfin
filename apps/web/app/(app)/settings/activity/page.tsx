'use client';

import { Tile, Skeleton, Badge } from '@perfin/ui';
import { useActivity } from '@/hooks/useActivity';

export default function ActivityPage() {
  const { data, isLoading } = useActivity();
  if (isLoading) return <Skeleton variant="tile" />;
  if (!data?.rows.length) {
    return <Tile className="text-text-muted text-sm">No agent actions yet. Ask Perfin to do something to see it appear here.</Tile>;
  }
  return (
    <div className="space-y-3">
      {data.rows.map((a) => (
        <Tile key={a.id} className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="accent">{a.tool}</Badge>
            <span className="text-xs text-text-subtle">{new Date(a.createdAt).toLocaleString()}</span>
          </div>
          <pre className="text-xs font-mono bg-surface-2 p-2 rounded-md overflow-x-auto">{JSON.stringify(a.input, null, 2)}</pre>
          {a.output != null && (
            <details className="text-xs">
              <summary className="cursor-pointer text-text-muted">Output</summary>
              <pre className="font-mono bg-surface-2 p-2 rounded-md overflow-x-auto mt-1">{JSON.stringify(a.output, null, 2)}</pre>
            </details>
          )}
        </Tile>
      ))}
    </div>
  );
}
