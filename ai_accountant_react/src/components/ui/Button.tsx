import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: Size; children: ReactNode; }

export function Button({ variant = 'secondary', size = 'md', className, children, ...props }: Props) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium transition-all duration-120 focus-visible:shadow-[var(--ring-focus)] outline-none disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer';
  const sizes: Record<Size, string> = { sm: 'h-8 px-4 text-xs', md: 'h-10 px-5 text-sm', lg: 'h-12 px-6 text-base' };
  const variants: Record<Variant, string> = {
    primary: 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] active:scale-[0.98] rounded-[var(--radius-full)]',
    secondary: 'bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--surface-hover)] active:scale-[0.98] rounded-[var(--radius-full)]',
    ghost: 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] rounded-[var(--radius-full)]',
    danger: 'bg-[var(--danger-soft)] text-[var(--danger)] hover:bg-[var(--danger-soft)] active:scale-[0.98] rounded-[var(--radius-full)]',
  };
  return <button className={clsx(base, sizes[size], variants[variant], className)} {...props}>{children}</button>;
}
