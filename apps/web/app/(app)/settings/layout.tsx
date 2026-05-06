import type { ReactNode } from 'react';
import Link from 'next/link';

const tabs = [
  { href: '/app/settings/activity', label: 'Activity' },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="p-8 max-w-5xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <nav className="flex gap-2 border-b border-border">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className="h-9 px-4 text-sm font-medium text-text-muted hover:text-text">
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
