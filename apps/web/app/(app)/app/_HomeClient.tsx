'use client';

import { Skeleton } from '@perfin/ui';
import { useHome } from '@/hooks/useHome';
import { HeroNetWorth } from '@/components/home/HeroNetWorth';
import { KpiStrip } from '@/components/home/KpiStrip';
import { TodayInsight } from '@/components/home/TodayInsight';
import { RecentActivity } from '@/components/home/RecentActivity';
import { InboxPreview } from '@/components/home/InboxPreview';

export default function HomeClient() {
  const { data, isLoading } = useHome();

  if (isLoading || !data) {
    return (
      <div className="p-8 max-w-6xl space-y-4">
        <Skeleton variant="tile" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="kpi" />)}
        </div>
        <Skeleton variant="tile" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl space-y-4">
      <h1 className="text-2xl font-semibold">Home</h1>
      <HeroNetWorth data={data} />
      <KpiStrip data={data} />
      <TodayInsight data={data} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2"><RecentActivity data={data} /></div>
        <InboxPreview />
      </div>
    </div>
  );
}
