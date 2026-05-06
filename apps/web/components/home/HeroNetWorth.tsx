'use client';

import { Tile, AreaSparkline } from '@perfin/ui';
import type { HomeData } from '@/hooks/useHome';

export function HeroNetWorth({ data }: { data: HomeData }) {
  return (
    <Tile variant="hero" className="space-y-4">
      <div>
        <div className="text-xs uppercase tracking-wider font-semibold text-text-subtle">Net worth</div>
        <div className="text-5xl font-mono font-semibold tracking-tight mt-1">{data.netWorthFormatted}</div>
      </div>
      <AreaSparkline values={data.sparkline90d} width={600} height={70} />
    </Tile>
  );
}
