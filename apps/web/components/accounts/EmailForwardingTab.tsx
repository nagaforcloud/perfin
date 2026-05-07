'use client';

import { useState } from 'react';
import { Tile, Button, Skeleton } from '@perfin/ui';
import { useEmailAddress } from '@/hooks/useEmailAddress';

export function EmailForwardingTab() {
  const { data, isLoading } = useEmailAddress();
  const [copied, setCopied] = useState(false);
  if (isLoading || !data) return <Skeleton variant="tile" />;
  return (
    <div className="space-y-4">
      <Tile variant="raised" className="space-y-3">
        <div className="text-xs uppercase tracking-wider font-semibold text-text-subtle">Your forwarding address</div>
        <div className="font-mono text-lg break-all">{data.address}</div>
        <Button size="sm" variant="secondary" onClick={async () => { await navigator.clipboard.writeText(data.address); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
          {copied ? '\u2713 Copied' : 'Copy address'}
        </Button>
      </Tile>
      <Tile className="space-y-2 text-sm text-text-muted">
        <div className="font-semibold text-text">Setting up forwarding</div>
        <ol className="list-decimal list-inside space-y-1">
          <li>Open your bank's online banking → Alerts settings.</li>
          <li>Enable transaction alerts via email.</li>
          <li>Add the address above as the destination (or set up a Gmail forward filter for alerts from your bank).</li>
          <li>Test with a small transaction; the row should appear within seconds.</li>
        </ol>
      </Tile>
    </div>
  );
}
