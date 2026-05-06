'use client';

import { Field, Input } from '@perfin/ui';
import { CATEGORIES } from '@perfin/core';
import type { TxnFilters } from '@/hooks/useTransactions';

interface Props {
  value: TxnFilters;
  onChange: (next: TxnFilters) => void;
}

export function TransactionFilters({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <Field label="Search">
        <Input
          placeholder="Description…"
          value={value.search ?? ''}
          onChange={(e) => onChange({ ...value, search: e.target.value || undefined })}
        />
      </Field>
      <Field label="Category">
        <select
          value={value.category ?? ''}
          onChange={(e) => onChange({ ...value, category: e.target.value || undefined })}
          className="h-10 w-full px-3 rounded-md bg-surface-2 border border-border-strong text-text"
        >
          <option value="">All</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="From">
        <Input type="date" value={value.start ?? ''} onChange={(e) => onChange({ ...value, start: e.target.value || undefined })} />
      </Field>
      <Field label="To">
        <Input type="date" value={value.end ?? ''} onChange={(e) => onChange({ ...value, end: e.target.value || undefined })} />
      </Field>
    </div>
  );
}
