'use client';

import { Tile } from '@perfin/ui';
import type { Account } from '@perfin/db';
import { formatCurrency } from '@/lib/currency';

export function AccountCard({ account }: { account: Account }) {
  return (
    <Tile variant="raised" className="space-y-3">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
          style={{ background: account.color }}
        >
          {account.name.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <div className="font-semibold">{account.name}</div>
          <div className="text-xs text-text-muted">{account.bank || account.type}</div>
        </div>
      </div>
      <div className="text-2xl font-mono font-semibold">
        {formatCurrency(account.balanceCents, account.currency)}
      </div>
    </Tile>
  );
}
