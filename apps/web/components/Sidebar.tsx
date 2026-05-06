'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sparkles, ListOrdered, Lightbulb, MessageSquare, Landmark, Target, BarChart3, Inbox, Upload,
} from 'lucide-react';
import { cn } from '@perfin/ui';

const items = [
  { href: '/app',              label: 'Home',            Icon: Sparkles },
  { href: '/app/transactions', label: 'Transactions',    Icon: ListOrdered },
  { href: '/app/insights',     label: 'Insights',        Icon: Lightbulb },
  { href: '/app/ask',          label: 'Ask',             Icon: MessageSquare },
  { href: '/app/accounts',     label: 'Accounts',        Icon: Landmark },
  { href: '/app/budgets',      label: 'Budgets & Goals', Icon: Target },
  { href: '/app/reports',      label: 'Reports',         Icon: BarChart3 },
  { href: '/app/inbox',        label: 'Inbox',           Icon: Inbox },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="w-60 h-screen bg-surface border-r border-border flex flex-col">
      <header className="h-16 px-5 flex items-center border-b border-border">
        <span className="text-text font-semibold">Perfin</span>
      </header>
      <nav className="flex-1 p-3 space-y-0.5" aria-label="Primary">
        {items.map(({ href, label, Icon }) => {
          const active = path === href || (href !== '/app' && path.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 h-9 px-3 rounded-md text-sm font-medium',
                'transition-colors duration-[120ms]',
                active
                  ? 'bg-accent-soft text-accent'
                  : 'text-text-muted hover:bg-surface-2 hover:text-text',
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <footer className="p-3 border-t border-border space-y-2">
        <Link
          href="/app/upload"
          className="flex items-center gap-2 h-9 px-3 rounded-md text-sm font-medium bg-accent text-white hover:bg-accent-hover"
        >
          <Upload className="w-4 h-4" /> Upload statement
        </Link>
        <p className="text-xs text-text-subtle px-3">v0.1 · Phase 1</p>
      </footer>
    </aside>
  );
}
