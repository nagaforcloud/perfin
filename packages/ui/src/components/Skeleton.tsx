import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export type SkeletonVariant = 'row' | 'tile' | 'kpi' | 'chart';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
}

const variantClass: Record<SkeletonVariant, string> = {
  row:   'h-4 w-full',
  tile:  'h-32 w-full',
  kpi:   'h-20 w-32',
  chart: 'h-64 w-full',
};

export function Skeleton({ variant = 'row', className, ...rest }: SkeletonProps) {
  return <div className={cn('skeleton', variantClass[variant], className)} {...rest} />;
}
