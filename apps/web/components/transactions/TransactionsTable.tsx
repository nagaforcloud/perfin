'use client';

import { Skeleton, Badge, cn } from '@perfin/ui';
import { formatCurrency } from '@/lib/currency';
import type { Transaction } from '@perfin/db';

interface Props {
  rows: Transaction[];
  loading?: boolean;
  onRowClick: (txn: Transaction) => void;
}

export function TransactionsTable({ rows, loading, onRowClick }: Props) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} variant="row" className="h-10" />)}
      </div>
    );
  }
  if (!rows.length) {
    return <div className="text-text-muted text-sm py-12 text-center">No transactions yet.</div>;
  }
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      {rows.map((t) => {
        const expense = t.amountCents < 0;
        return (
          <button
            key={t.id}
            onClick={() => onRowClick(t)}
            className={cn(
              'w-full grid grid-cols-[80px_1fr_140px_110px] items-center gap-3',
              'px-4 py-3 text-left text-sm border-b border-border last:border-0',
              'hover:bg-surface-2 transition-colors duration-[120ms]',
            )}
          >
            <span className="text-text-muted font-mono text-xs">{t.date}</span>
            <span className="font-medium text-text truncate">{t.description}</span>
            <Badge variant={expense ? 'expense' : 'income'}>{t.category}</Badge>
            <span className={cn('font-mono font-medium text-right', expense ? 'text-negative' : 'text-positive')}>
              {formatCurrency(t.amountCents, 'INR', { withSign: !expense })}
            </span>
          </button>
        );
      })}
    </div>
  );
}
