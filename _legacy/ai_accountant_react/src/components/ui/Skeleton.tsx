import { clsx } from 'clsx';

export function Skeleton({ className }: { className?: string }) { return <div className={clsx('skeleton', className)} />; }
Skeleton.Card = () => <Skeleton className="h-40 rounded-[var(--radius-xl)]" />;
Skeleton.Row = () => <Skeleton className="h-10 rounded-[var(--radius-sm)] mb-1.5" />;
Skeleton.KPI = () => <Skeleton className="h-28 rounded-[var(--radius-xl)]" />;
Skeleton.Chart = () => <Skeleton className="h-64 rounded-[var(--radius-xl)]" />;
Skeleton.Text = ({ w = '100%' }: { w?: string }) => <Skeleton className="h-4 mb-2 rounded" style={{ width: w }} />;
