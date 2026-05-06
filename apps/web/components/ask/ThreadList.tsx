'use client';

import Link from 'next/link';
import { useThreads } from '@/hooks/useThreads';
import { cn } from '@perfin/ui';

export function ThreadList({ activeId }: { activeId: number | null }) {
  const { data, isLoading } = useThreads();
  return (
    <aside className="w-60 h-full border-r border-border p-3 space-y-1 overflow-y-auto">
      <Link href="/app/ask" className="block h-9 px-3 rounded-md text-sm font-medium bg-accent text-white grid items-center hover:bg-accent-hover">
        + New chat
      </Link>
      <div className="text-xs uppercase tracking-wider font-semibold text-text-subtle px-2 mt-3">Recent</div>
      {isLoading
        ? <div className="text-xs text-text-muted px-2">Loading…</div>
        : (data?.rows ?? []).map((t) => (
          <Link
            key={t.id}
            href={`/app/ask?thread=${t.id}`}
            className={cn(
              'block px-3 py-2 rounded-md text-sm truncate',
              activeId === t.id ? 'bg-accent-soft text-accent' : 'text-text-muted hover:bg-surface-2 hover:text-text',
            )}
          >
            {t.title}
          </Link>
        ))}
    </aside>
  );
}
