'use client';

import { Skeleton, Tile, Button, Modal, Field, Input } from '@perfin/ui';
import { useState } from 'react';
import { useAccounts, useCreateAccount } from '@/hooks/useAccounts';
import { AccountCard } from './AccountCard';

export function AccountsGrid() {
  const { data, isLoading } = useAccounts();
  const create = useCreateAccount();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [bank, setBank] = useState('');
  const [type, setType] = useState('checking');
  const [currency, setCurrency] = useState('INR');

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="tile" />)}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data?.rows.map((a) => <AccountCard key={a.id} account={a} />)}
        <Tile className="border-dashed flex items-center justify-center min-h-[140px]">
          <Button variant="ghost" onClick={() => setOpen(true)}>+ Add account</Button>
        </Tile>
      </div>
      <Modal open={open} onOpenChange={setOpen} title="Add account">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name) return;
            await create.mutateAsync({ name, bank, type, currency });
            setOpen(false);
            setName(''); setBank(''); setType('checking');
          }}
        >
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
          <Field label="Bank"><Input value={bank} onChange={(e) => setBank(e.target.value)} /></Field>
          <Field label="Type">
            <select value={type} onChange={(e) => setType(e.target.value)} className="h-10 w-full px-3 rounded-md bg-surface-2 border border-border-strong text-text">
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="credit">Credit card</option>
              <option value="cash">Cash</option>
              <option value="investment">Investment</option>
            </select>
          </Field>
          <Field label="Currency">
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-10 w-full px-3 rounded-md bg-surface-2 border border-border-strong text-text">
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={create.isPending}>
              {create.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
