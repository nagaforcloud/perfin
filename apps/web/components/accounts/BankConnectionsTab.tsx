'use client';

import { Tile, Skeleton } from '@perfin/ui';
import { useConnections } from '@/hooks/useConnections';
import { ConnectionCard } from './ConnectionCard';
import { PlaidLinkButton } from './PlaidLinkButton';

export function BankConnectionsTab() {
  const { data, isLoading } = useConnections();
  if (isLoading) return <Skeleton variant="tile" />;
  const banks = (data?.rows ?? []).filter((r) => r.provider === 'plaid');
  return (
    <div className="space-y-4">
      <div><PlaidLinkButton /></div>
      {banks.length === 0
        ? <Tile className="text-center text-text-muted">No bank connections yet.</Tile>
        : <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{banks.map((c) => <ConnectionCard key={c.id} conn={c} />)}</div>}
    </div>
  );
}
