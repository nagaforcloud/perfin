'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@perfin/ui';

const items = [
  { href: '/app',              label: 'Home',            icon: '◆' },
  { href: '/app/transactions', label: 'Transactions',    icon: '≡' },
  { href: '/app/insights',     label: 'Insights',        icon: '✨' },
  { href: '/app/ask',          label: 'Ask',             icon: '✦' },
  { href: '/app/accounts',     label: 'Accounts',        icon: '⌂' },
  { href: '/app/budgets',      label: 'Budgets & Goals', icon: '◎' },
  { href: '/app/reports',      label: 'Reports',         icon: '▤' },
  { href: '/app/inbox',        label: 'Inbox',           icon: '✉' },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="w-60 h-screen bg-surface border-r border-border flex flex-col">
      <header className="h-16 px-5 flex items-center border-b border-border">
        <span className="text-text font-semibold">Perfin</span>
      </header>
      <nav className="flex-1 p-3 space-y-0.5" aria-label="Primary">
        {items.map((it) => {
          const active = path === it.href || (it.href !== '/app' && path.startsWith(it.href));
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                'flex items-center gap-2 h-9 px-3 rounded-md text-sm font-medium',
                'transition-colors duration-[120ms]',
                active
                  ? 'bg-accent-soft text-accent'
                  : 'text-text-muted hover:bg-surface-2 hover:text-text',
              )}
            >
              <span aria-hidden className="w-4 text-center">{it.icon}</span>
              <span>{it.label}</span>
            </Link>
          );
        })}
      </nav>
      <footer className="p-3 border-t border-border text-xs text-text-subtle">
        v0.1 · Phase 0
      </footer>
    </aside>
  );
}
