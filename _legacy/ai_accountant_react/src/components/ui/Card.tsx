import type { ReactNode } from 'react';
import { clsx } from 'clsx';

interface Props { className?: string; children: ReactNode; }

export function CardHeader({ className, children }: Props) { return <div className={clsx('flex flex-col gap-0.5', className)}>{children}</div>; }
export function CardBody({ className, children }: Props) { return <div className={clsx('flex-1', className)}>{children}</div>; }
export function CardFooter({ className, children }: Props) { return <div className={clsx('pt-3 border-t border-[var(--border)]', className)}>{children}</div>; }

interface CardProps { className?: string; children: ReactNode; title?: string; kicker?: string; }

export function Card({ className, children, title, kicker }: CardProps) {
  return (
    <div className={clsx('bg-[var(--surface)] rounded-[var(--radius-xl)] shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5 transition-all duration-120 p-5', className)}>
      {(title || kicker) && (
        <div className="mb-3">
          {kicker && <div className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wider mb-0.5">{kicker}</div>}
          {title && <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>}
        </div>
      )}
      {children}
    </div>
  );
}

export function SectionHead({ title, kicker }: { title: string; kicker?: string }) {
  return (
    <div className="mb-5">
      {kicker && <div className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wider mb-1">{kicker}</div>}
      <h2 className="text-xl font-semibold text-[var(--text)]">{title}</h2>
    </div>
  );
}
