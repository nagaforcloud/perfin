'use client';

import { Tile, Skeleton, Button, Modal, Field, Input } from '@perfin/ui';
import { useState } from 'react';
import { useAccounts, useCreateAccount } from '@/hooks/useAccounts';
import { AccountCard } from '@/components/accounts/AccountCard';

export function ManualAccountsTab() {
  const { data, isLoading } = useAccounts();
  const create = useCreateAccount();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [bank, setBank] = useState('');

  if (isLoading) return <Skeleton variant="tile" />;
  return (
    <div className="space-y-4">
      <Button variant="primary" onClick={() => setOpen(true)}>+ Add account</Button>
      {(data?.rows ?? []).length === 0
        ? <Tile className="text-center text-text-muted">No manual accounts.</Tile>
        : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(data!.rows.filter((a) => a.connectionId == null)).map((a) => <AccountCard key={a.id} account={a} />)}
          </div>}
      <Modal open={open} onOpenChange={setOpen} title="Add manual account">
        <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (!name) return; await create.mutateAsync({ name, bank }); setOpen(false); setName(''); setBank(''); }}>
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
          <Field label="Bank"><Input value={bank} onChange={(e) => setBank(e.target.value)} /></Field>
          <div className="flex justify-end gap-2"><Button variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={create.isPending}>Save</Button></div>
        </form>
      </Modal>
    </div>
  );
}
