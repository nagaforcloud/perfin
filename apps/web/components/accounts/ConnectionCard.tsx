'use client';

import { Tile, Badge, Button } from '@perfin/ui';
import { useDisconnectConnection, useSyncConnection, type ConnectionRow } from '@/hooks/useConnections';

export function ConnectionCard({ conn }: { conn: ConnectionRow }) {
  const disconnect = useDisconnectConnection();
  const sync = useSyncConnection();
  return (
    <Tile variant="raised" className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">{conn.provider.toUpperCase()}</div>
          <div className="text-xs text-text-subtle">{conn.providerAccountId ?? '\u2014'}</div>
        </div>
        <Badge variant={conn.status === 'active' ? 'income' : conn.status === 'error' ? 'expense' : 'neutral'}>{conn.status}</Badge>
      </div>
      {conn.error && <div className="text-xs text-negative">{conn.error}</div>}
      <div className="text-xs text-text-muted">Last sync: {conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleString() : 'never'}</div>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => sync.mutate(conn.id)} disabled={sync.isPending || conn.status !== 'active'}>{sync.isPending ? 'Syncing…' : 'Sync now'}</Button>
        <Button size="sm" variant="ghost" onClick={() => disconnect.mutate(conn.id)} disabled={disconnect.isPending || conn.status === 'disconnected'}>Disconnect</Button>
      </div>
    </Tile>
  );
}
