'use client';

import { Tile, Badge } from '@perfin/ui';
import Link from 'next/link';
import { useInbox } from '@/hooks/useInbox';

export function InboxPreview() {
  const { data, isLoading } = useInbox();
  const count = data?.count ?? 0;

  return (
    <Tile className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Inbox</h2>
        <Link href="/app/inbox" className="text-xs text-accent">Open →</Link>
      </div>
      {isLoading ? (
        <div className="text-sm text-text-muted">Loading…</div>
      ) : count === 0 ? (
        <div className="text-sm text-text-muted">Nothing needs review.</div>
      ) : (
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="warning">{count}</Badge>
          <span>{count === 1 ? 'item' : 'items'} need review</span>
        </div>
      )}
    </Tile>
  );
}
