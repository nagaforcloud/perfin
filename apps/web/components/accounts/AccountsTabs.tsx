'use client';

import { cn } from '@perfin/ui';

const tabs = [
  { key: 'bank',     label: 'Bank connections' },
  { key: 'manual',   label: 'Manual accounts' },
  { key: 'uploads',  label: 'Uploads' },
  { key: 'email',    label: 'Email forwarding' },
] as const;

export type AccountsTabKey = typeof tabs[number]['key'];

export function AccountsTabs({ value, onChange }: { value: AccountsTabKey; onChange: (k: AccountsTabKey) => void }) {
  return (
    <div className="flex gap-2 border-b border-border">
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={cn('h-9 px-4 text-sm font-medium transition-colors duration-[120ms]',
            value === t.key ? 'text-accent border-b-2 border-accent' : 'text-text-muted hover:text-text')}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
