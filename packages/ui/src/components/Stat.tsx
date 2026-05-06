import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface StatProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: ReactNode;
  deltaText?: string;
  deltaTone?: 'income' | 'expense' | 'neutral';
}

const toneClass = {
  income: 'bg-positive-soft text-positive',
  expense: 'bg-negative-soft text-negative',
  neutral: 'bg-surface-3 text-text-muted',
} as const;

export function Stat({ label, value, deltaText, deltaTone = 'neutral', className, ...rest }: StatProps) {
  return (
    <div className={cn('p-4 rounded-lg bg-surface border border-border', className)} {...rest}>
      <div className="text-xs uppercase tracking-wider text-text-subtle font-semibold">{label}</div>
      <div className="text-2xl font-mono font-semibold mt-1">{value}</div>
      {deltaText && (
        <div className={cn('inline-flex items-center px-2 h-5 rounded-full text-xs font-semibold mt-2', toneClass[deltaTone])}>
          {deltaText}
        </div>
      )}
    </div>
  );
}
