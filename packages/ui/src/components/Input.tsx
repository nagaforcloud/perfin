import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...rest }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full px-3 rounded-md',
        'bg-surface-2 border border-border-strong',
        'text-text placeholder:text-text-subtle',
        'transition-colors duration-[120ms]',
        'focus:outline-none focus:border-accent focus:shadow-ring',
        'disabled:opacity-50',
        className,
      )}
      {...rest}
    />
  ),
);
Input.displayName = 'Input';

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, htmlFor, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-text-muted">
        {label}
      </label>
      {children}
      {error
        ? <p className="text-xs text-negative">{error}</p>
        : hint
          ? <p className="text-xs text-text-subtle">{hint}</p>
          : null}
    </div>
  );
}
