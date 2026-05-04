import { TrendingUp, TrendingDown } from 'lucide-react';
import { clsx } from 'clsx';

interface Props { label: string; value: string; change?: number; changeLabel?: string; format?: 'currency' | 'number' | 'percent'; className?: string; }

function fmt(v: number, f: string) {
  if (f === 'currency') return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);
  if (f === 'percent') return v.toFixed(1) + '%';
  return v.toLocaleString('en-IN');
}

export function Stat({ label, value, change, changeLabel, format = 'number', className }: Props) {
  const up = change !== undefined && change > 0;
  const down = change !== undefined && change < 0;
  const changeCls = up ? 'text-[var(--success)]' : down ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]';
  return (
    <div className={clsx('flex flex-col', className)}>
      <span className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">{label}</span>
      <span className="text-2xl font-semibold tabular mt-1">{value}</span>
      {change !== undefined && (
        <span className={clsx('inline-flex items-center gap-1 text-sm font-medium mt-1', changeCls)}>
          {up ? <TrendingUp size={14} /> : down ? <TrendingDown size={14} /> : null}
          {changeLabel || `${up ? '+' : ''}${fmt(change, format)}`}
        </span>
      )}
    </div>
  );
}
