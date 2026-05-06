'use client';

import { AITile, Button } from '@perfin/ui';
import Link from 'next/link';
import type { HomeData } from '@/hooks/useHome';

export function TodayInsight({ data }: { data: HomeData }) {
  if (!data.todayInsight) {
    return (
      <AITile
        headline="Today's insight"
        body="Once you've imported ~30 days of transactions, Perfin will start surfacing patterns here."
      />
    );
  }
  const { headline, body } = data.todayInsight;
  return (
    <AITile
      headline={headline}
      body={body}
      actions={
        <>
          <Link href="/app/insights"><Button variant="secondary" size="sm">Show me</Button></Link>
          <Button variant="ghost" size="sm">Dismiss</Button>
        </>
      }
    />
  );
}
