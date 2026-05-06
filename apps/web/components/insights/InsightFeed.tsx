'use client';

import { Skeleton } from '@perfin/ui';
import type { InsightRow } from '@/hooks/useInsights';
import { InsightCard } from './InsightCard';

export function InsightFeed({ rows, loading }: { rows: InsightRow[]; loading: boolean }) {
  if (loading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="tile" />)}</div>;
  }
  if (!rows.length) {
    return <div className="text-text-muted text-sm py-12 text-center">No insights yet.</div>;
  }
  return <div className="space-y-3">{rows.map((r) => <InsightCard key={r.id} insight={r} />)}</div>;
}
