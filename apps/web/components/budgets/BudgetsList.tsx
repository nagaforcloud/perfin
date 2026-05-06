'use client';

import { Tile, Skeleton } from '@perfin/ui';
import { useBudgets } from '@/hooks/useBudgets';
import { BudgetRow } from './BudgetRow';

export function BudgetsList() {
  const { data, isLoading } = useBudgets();
  if (isLoading) return <Skeleton variant="tile" />;
  if (!data?.rows.length) {
    return (
      <Tile className="text-center text-text-muted text-sm py-12">
        No budgets yet. Create a budget on the Settings page (coming soon).
      </Tile>
    );
  }
  return (
    <Tile className="px-4">
      {data.rows.map((r) => <BudgetRow key={r.budgetId} row={r} />)}
    </Tile>
  );
}
