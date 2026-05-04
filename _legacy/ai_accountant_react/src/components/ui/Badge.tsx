import type { ReactNode } from 'react';
import { clsx } from 'clsx';

type Variant = 'neutral' | 'income' | 'expense' | 'warning' | 'info';

interface Props { variant?: Variant; className?: string; children: ReactNode; }

const v: Record<Variant, string> = {
  neutral: 'bg-[var(--surface-2)] text-[var(--text-muted)]',
  income: 'bg-[var(--success-soft)] text-[var(--success)]',
  expense: 'bg-[var(--danger-soft)] text-[var(--danger)]',
  warning: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  info: 'bg-[var(--info-soft)] text-[var(--info)]',
};

export function Badge({ variant = 'neutral', className, children }: Props) {
  return <span className={clsx('inline-flex items-center h-6 px-2.5 rounded-[var(--radius-full)] text-xs font-medium', v[variant], className)}>{children}</span>;
}
