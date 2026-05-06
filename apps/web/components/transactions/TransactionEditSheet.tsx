'use client';

import { useState, useEffect } from 'react';
import { Modal, Button, Field, Input, Badge } from '@perfin/ui';
import { CATEGORIES } from '@perfin/core';
import type { Transaction } from '@perfin/db';
import { useUpdateTransaction } from '@/hooks/useTransactions';
import { formatCurrency } from '@/lib/currency';

interface Props {
  txn: Transaction | null;
  onClose: () => void;
}

export function TransactionEditSheet({ txn, onClose }: Props) {
  const update = useUpdateTransaction();
  const [category, setCategory] = useState(txn?.category ?? 'Needs Review');
  const [description, setDescription] = useState(txn?.description ?? '');

  useEffect(() => {
    if (txn) {
      setCategory(txn.category);
      setDescription(txn.description);
    }
  }, [txn]);

  if (!txn) return null;

  return (
    <Modal open={!!txn} onOpenChange={(o) => { if (!o) onClose(); }} title="Edit transaction" size="md">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-text-muted text-sm font-mono">{txn.date}</span>
          <span className="font-mono font-medium">
            {formatCurrency(txn.amountCents, 'INR')}
          </span>
        </div>
        <Field label="Description">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="Category">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-10 w-full px-3 rounded-md bg-surface-2 border border-border-strong text-text"
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Badge variant="neutral">Raw: {txn.rawDescription}</Badge>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={update.isPending}
            onClick={async () => {
              await update.mutateAsync({ id: txn.id, patch: { category, description } });
              onClose();
            }}
          >
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
