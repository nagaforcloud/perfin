'use client';

import { Tile, Badge, cn } from '@perfin/ui';
import Link from 'next/link';
import type { HomeData } from '@/hooks/useHome';

export function RecentActivity({ data }: { data: HomeData }) {
  return (
    <Tile className="space-y-3 p-0 overflow-hidden">
      <header className="flex items-center justify-between p-4 pb-0">
        <h2 className="font-semibold">Recent activity</h2>
        <Link href="/app/transactions" className="text-xs text-accent">All transactions →</Link>
      </header>
      <div>
        {data.recent.map((t) => {
          const expense = t.amountCents < 0;
          return (
            <div key={t.id} className="grid grid-cols-[80px_1fr_120px_110px] items-center gap-3 px-4 py-3 text-sm border-t border-border">
              <span className="text-text-muted font-mono text-xs">{t.date}</span>
              <span className="font-medium truncate">{t.description}</span>
              <Badge variant={expense ? 'expense' : 'income'}>{t.category}</Badge>
              <span className={cn('font-mono font-medium text-right', expense ? 'text-negative' : 'text-positive')}>
                {t.amountFormatted}
              </span>
            </div>
          );
        })}
      </div>
    </Tile>
  );
}
