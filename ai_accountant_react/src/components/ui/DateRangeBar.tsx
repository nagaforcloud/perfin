import { clsx } from 'clsx';

export type RangeOption = '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';
export const RANGE_OPTIONS: RangeOption[] = ['1M', '3M', '6M', 'YTD', '1Y', 'ALL'];

export function rangeToParams(range: RangeOption): { start_date?: string; end_date?: string } {
  const now = new Date(); const end = now.toISOString().slice(0, 10); const start = new Date(now);
  switch (range) { case '1M': start.setMonth(start.getMonth()-1); break; case '3M': start.setMonth(start.getMonth()-3); break; case '6M': start.setMonth(start.getMonth()-6); break; case 'YTD': start.setMonth(0); start.setDate(1); break; case '1Y': start.setFullYear(start.getFullYear()-1); break; case 'ALL': return {}; }
  return { start_date: start.toISOString().slice(0, 10), end_date: end };
}

export function DateRangeBar({ value, onChange, className }: { value: RangeOption; onChange: (r: RangeOption) => void; className?: string }) {
  return (
    <div className={clsx('flex bg-[var(--surface-2)] rounded-[var(--radius-full)] p-0.5', className)}>
      {RANGE_OPTIONS.map(r => (
        <button key={r} onClick={() => onChange(r)} className={clsx('px-3 py-1 text-xs font-medium rounded-[var(--radius-full)] transition-colors', value === r ? 'bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-card)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]')}>{r}</button>
      ))}
    </div>
  );
}
