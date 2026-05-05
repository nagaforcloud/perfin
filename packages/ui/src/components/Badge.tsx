import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export type BadgeVariant = 'income' | 'expense' | 'warning' | 'info' | 'accent' | 'neutral';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClass: Record<BadgeVariant, string> = {
  income:  'bg-positive-soft text-positive',
  expense: 'bg-negative-soft text-negative',
  warning: 'bg-warning-soft text-warning',
  info:    'bg-info-soft text-info',
  accent:  'bg-accent-soft text-accent',
  neutral: 'bg-surface-3 text-text-muted',
};

export function Badge({ variant = 'neutral', className, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 h-6 px-2 rounded-full',
        'text-xs font-semibold',
        variantClass[variant],
        className,
      )}
      {...rest}
    />
  );
}
