'use client';

import { cn } from '@perfin/ui';

const tabs = [
  { key: 'all',                 label: 'All' },
  { key: 'anomaly',             label: 'Anomalies' },
  { key: 'recurring_detected', label: 'Recurring' },
  { key: 'category_drift',      label: 'Trends' },
] as const;

export type InsightTabKey = typeof tabs[number]['key'];

export function InsightTabs({ value, onChange }: { value: InsightTabKey; onChange: (k: InsightTabKey) => void }) {
  return (
    <div className="flex gap-2 border-b border-border">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'h-9 px-4 text-sm font-medium transition-colors duration-[120ms]',
            value === t.key ? 'text-accent border-b-2 border-accent' : 'text-text-muted hover:text-text',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
