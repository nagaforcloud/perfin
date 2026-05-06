'use client';

import { cn } from '@perfin/ui';
import type { BudgetStatusRow } from '@/hooks/useBudgets';

export function BudgetRow({ row }: { row: BudgetStatusRow }) {
  const over = row.percent > 100;
  const fillClass = over ? 'bg-negative' : 'bg-accent';
  return (
    <div className="space-y-2 py-3 border-b border-border last:border-0">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{row.category}</span>
        <span className="font-mono text-text-muted">
          {row.spentFormatted} / {row.budgetFormatted}
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
        <div
          className={cn('h-full transition-[width] duration-200', fillClass)}
          style={{ width: `${Math.min(100, row.percent)}%` }}
        />
      </div>
      <div className="text-xs text-text-subtle">
        {over ? `Over by ${row.remainingFormatted.replace('\u2212', '')}` : `${row.remainingFormatted} left`}
      </div>
    </div>
  );
}
