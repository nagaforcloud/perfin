import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClass: Record<ButtonVariant, string> = {
  primary:   'bg-accent text-white hover:bg-accent-hover',
  secondary: 'bg-surface-2 border border-border-strong text-text hover:bg-[var(--surface-hover)]',
  ghost:     'text-text-muted hover:bg-surface-2 hover:text-text',
  danger:    'bg-negative text-text-inverse hover:opacity-90',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm rounded-md',
  md: 'h-10 px-4 text-sm rounded-md',
  lg: 'h-12 px-5 text-base rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium',
        'transition-colors duration-[120ms]',
        'focus-visible:outline-none focus-visible:shadow-ring',
        'disabled:opacity-50 disabled:pointer-events-none',
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    />
  ),
);
Button.displayName = 'Button';
