'use client';

import { Tile, Badge, Button } from '@perfin/ui';
import type { InsightRow } from '@/hooks/useInsights';
import { useDismissInsight } from '@/hooks/useInsights';

const kindLabel: Record<InsightRow['kind'], string> = {
  anomaly: 'Anomaly',
  recurring_detected: 'Recurring',
  category_drift: 'Trend',
  monthly_narrative: 'Monthly recap',
};

const kindTone: Record<InsightRow['kind'], 'warning' | 'info' | 'accent' | 'income'> = {
  anomaly: 'warning',
  recurring_detected: 'info',
  category_drift: 'accent',
  monthly_narrative: 'income',
};

export function InsightCard({ insight }: { insight: InsightRow }) {
  const dismiss = useDismissInsight();
  return (
    <Tile className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant={kindTone[insight.kind]}>{kindLabel[insight.kind]}</Badge>
        <span className="text-xs text-text-subtle">confidence {(insight.confidence * 100).toFixed(0)}%</span>
      </div>
      <h3 className="font-semibold">{insight.headline}</h3>
      <p className="text-sm text-text-muted">{insight.body}</p>
      <div className="flex gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={() => dismiss.mutate(insight.id)} disabled={dismiss.isPending}>
          Dismiss
        </Button>
      </div>
    </Tile>
  );
}
