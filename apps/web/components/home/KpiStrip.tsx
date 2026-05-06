'use client';

import { Stat } from '@perfin/ui';
import type { HomeData } from '@/hooks/useHome';

export function KpiStrip({ data }: { data: HomeData }) {
  const { kpis } = data;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Stat label="INCOME · MO" value={kpis.incomeFormatted} />
      <Stat label="EXPENSES · MO" value={kpis.expensesFormatted} />
      <Stat label="SAVINGS RATE" value={`${(kpis.savingsRate * 100).toFixed(0)}%`} />
      <Stat label="TOP CATEGORY" value={kpis.topCategory.name} deltaText={kpis.topCategory.formatted} deltaTone="neutral" />
    </div>
  );
}
