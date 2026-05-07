'use client';

import Link from 'next/link';
import { Tile, Button } from '@perfin/ui';
import { hasFeature, type Feature } from '@perfin/billing';
import { usePlan } from '@/hooks/usePlan';
import type { ReactNode } from 'react';

export function PlanGate({ feature, children }: { feature: Feature; children: ReactNode }) {
  const { data, isLoading } = usePlan();
  if (isLoading) return null;
  if (data && hasFeature(data.plan, feature)) return <>{children}</>;
  return (
    <Tile className="space-y-3">
      <div className="text-sm text-text-muted">This is a Plus / Pro feature.</div>
      <Link href="/pricing"><Button variant="primary" size="sm">Upgrade</Button></Link>
    </Tile>
  );
}
