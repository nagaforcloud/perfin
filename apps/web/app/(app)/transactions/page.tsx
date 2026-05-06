'use client';

import { useState } from 'react';
import { Button } from '@perfin/ui';
import Link from 'next/link';
import type { Transaction } from '@perfin/db';
import { useTransactions, type TxnFilters } from '@/hooks/useTransactions';
import { TransactionsTable } from '@/components/transactions/TransactionsTable';
import { TransactionFilters } from '@/components/transactions/TransactionFilters';
import { TransactionEditSheet } from '@/components/transactions/TransactionEditSheet';

export default function TransactionsPage() {
  const [filters, setFilters] = useState<TxnFilters>({});
  const [active, setActive] = useState<Transaction | null>(null);
  const { data, isLoading } = useTransactions(filters);

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <Link href="/app/upload"><Button variant="primary">+ Upload</Button></Link>
      </div>
      <TransactionFilters value={filters} onChange={setFilters} />
      <TransactionsTable
        rows={data?.rows ?? []}
        loading={isLoading}
        onRowClick={setActive}
      />
      <TransactionEditSheet txn={active} onClose={() => setActive(null)} />
    </div>
  );
}
