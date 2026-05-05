import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: ReactNode;
  tone?: ToastTone;
}

const toneClass: Record<ToastTone, string> = {
  info:    'border-l-info',
  success: 'border-l-positive',
  warning: 'border-l-warning',
  error:   'border-l-negative',
};

export function Toast({ title, description, tone = 'info', className, ...rest }: ToastProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col gap-1 p-3 pl-4 rounded-md',
        'bg-surface border border-border border-l-4',
        'shadow-2 max-w-sm',
        toneClass[tone],
        className,
      )}
      {...rest}
    >
      <div className="text-sm font-semibold text-text">{title}</div>
      {description ? <div className="text-xs text-text-muted">{description}</div> : null}
    </div>
  );
}
