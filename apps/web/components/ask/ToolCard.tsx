'use client';

import { cn } from '@perfin/ui';

export interface ToolCardProps {
  toolName: string;
  status: 'running' | 'done' | 'error';
  summary?: string;
  ms?: number;
}

export function ToolCard({ toolName, status, summary, ms }: ToolCardProps) {
  const icon = status === 'done' ? '\u2713' : status === 'error' ? '\u2715' : '\u22EF';
  const color = status === 'done' ? 'text-positive' : status === 'error' ? 'text-negative' : 'text-text-muted';
  return (
    <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md font-mono text-xs bg-surface border border-dashed border-border-strong text-text-muted">
      <span className={cn(color, 'font-semibold')}>{icon}</span>
      <span className="text-text">{toolName}</span>
      {summary && <span>\u00B7 {summary}</span>}
      {typeof ms === 'number' && <span>\u00B7 {ms}ms</span>}
    </div>
  );
}
