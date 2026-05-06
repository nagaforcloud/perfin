'use client';

import { useState } from 'react';
import { useInsights } from '@/hooks/useInsights';
import { InsightTabs, type InsightTabKey } from '@/components/insights/InsightTabs';
import { InsightFeed } from '@/components/insights/InsightFeed';

export default function InsightsPage() {
  const [tab, setTab] = useState<InsightTabKey>('all');
  const { data, isLoading } = useInsights(tab === 'all' ? undefined : tab);
  return (
    <div className="p-8 max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Insights</h1>
      <InsightTabs value={tab} onChange={setTab} />
      <InsightFeed rows={data?.rows ?? []} loading={isLoading} />
    </div>
  );
}
