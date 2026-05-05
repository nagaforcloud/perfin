import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export type TileVariant = 'default' | 'raised' | 'hero';

export interface TileProps extends HTMLAttributes<HTMLDivElement> {
  variant?: TileVariant;
}

const variantClass: Record<TileVariant, string> = {
  default: 'bg-surface border border-border p-4',
  raised:  'bg-surface-2 border border-border-strong shadow-1 p-4',
  hero:    'bg-surface border border-border-strong p-6',
};

export const Tile = forwardRef<HTMLDivElement, TileProps>(
  ({ variant = 'default', className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-lg', variantClass[variant], className)}
      {...rest}
    />
  ),
);
Tile.displayName = 'Tile';
