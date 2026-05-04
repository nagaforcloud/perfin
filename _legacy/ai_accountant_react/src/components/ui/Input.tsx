import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

const base = 'h-10 px-3 rounded-[var(--radius-md)] bg-[var(--surface-2)] border-0 text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:bg-[var(--surface)] focus:shadow-[var(--ring-focus)] outline-none transition-all duration-120 w-full';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) { return <input className={clsx(base, className)} {...props} />; }
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) { return <select className={clsx(base, 'cursor-pointer', className)} {...props}>{children}</select>; }
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea className={clsx(base, 'h-auto py-2', className)} {...props} />; }

export function Field({ label, hint, error, children }: { label?: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-[var(--text)]">{label}</label>}
      {children}
      {hint && !error && <span className="text-xs text-[var(--text-subtle)]">{hint}</span>}
      {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
    </div>
  );
}
