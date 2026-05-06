'use client';

import { Tile, Badge, Skeleton } from '@perfin/ui';
import Link from 'next/link';
import { useInbox } from '@/hooks/useInbox';

export function InboxList() {
  const { data, isLoading } = useInbox();
  if (isLoading || !data) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="tile" />)}</div>;
  }
  if (data.count === 0) return <p className="text-text-muted">Inbox zero.</p>;

  return (
    <div className="space-y-3">
      {data.needsReview.map((t) => (
        <Tile key={`nr-${t.id}`} className="flex items-center justify-between">
          <div>
            <Badge variant="warning">Needs review</Badge>
            <div className="font-medium mt-1">{t.description}</div>
            <div className="text-xs text-text-subtle font-mono mt-1">{t.date}</div>
          </div>
          <Link href="/app/transactions" className="text-accent text-sm">Categorize →</Link>
        </Tile>
      ))}
      {data.anomalies.map((a) => (
        <Tile key={`an-${a.id}`} className="space-y-1">
          <Badge variant="warning">Anomaly</Badge>
          <div className="font-medium">{a.reason}</div>
          <div className="text-xs text-text-subtle">confidence {(a.score * 100).toFixed(0)}%</div>
        </Tile>
      ))}
    </div>
  );
}
