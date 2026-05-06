import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface AITileProps {
  headline: string;
  body: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function AITile({ headline, body, actions, className }: AITileProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg p-4',
        'border border-[var(--accent-soft)]',
        'bg-[linear-gradient(135deg,rgba(99,102,241,0.10)_0%,rgba(99,102,241,0.02)_100%)]',
        className,
      )}
    >
      <div className="text-xs uppercase tracking-wider font-semibold text-accent">⚡ {headline}</div>
      <div className="mt-2 text-text">{body}</div>
      {actions && <div className="mt-3 flex gap-2">{actions}</div>}
    </div>
  );
}
