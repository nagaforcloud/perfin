'use client';

import ReactMarkdown from 'react-markdown';
import { cn } from '@perfin/ui';
import type { ReactNode } from 'react';

export interface ChatBubbleProps {
  role: 'user' | 'assistant';
  children: ReactNode;
}

export function ChatBubble({ role, children }: ChatBubbleProps) {
  const me = role === 'user';
  return (
    <div className={cn('flex gap-3', me ? 'justify-end' : 'justify-start')}>
      {!me && <div className="w-7 h-7 rounded-full bg-accent text-white grid place-items-center text-xs font-semibold">P</div>}
      <div className={cn(
        'max-w-[80%] rounded-lg px-3 py-2 text-sm leading-relaxed',
        me ? 'bg-accent-soft border border-[var(--accent-soft)]' : 'bg-surface-2 border border-border',
      )}>
        {typeof children === 'string'
          ? <ReactMarkdown components={{ p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p> }}>{children}</ReactMarkdown>
          : children}
      </div>
      {me && <div className="w-7 h-7 rounded-full bg-surface-3 text-text grid place-items-center text-xs font-semibold">N</div>}
    </div>
  );
}
