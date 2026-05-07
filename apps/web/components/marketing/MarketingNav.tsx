import Link from 'next/link';
import { Button } from '@perfin/ui';

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-bg/80 border-b border-border">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold">Perfin</Link>
        <nav className="hidden md:flex gap-6 text-sm">
          <Link href="/pricing" className="text-text-muted hover:text-text">Pricing</Link>
          <Link href="/how-it-works" className="text-text-muted hover:text-text">How it works</Link>
          <Link href="/security" className="text-text-muted hover:text-text">Security</Link>
          <Link href="/changelog" className="text-text-muted hover:text-text">Changelog</Link>
        </nav>
        <div className="flex gap-2">
          <Link href="/login"><Button variant="ghost" size="sm">Log in</Button></Link>
          <Link href="/signup"><Button variant="primary" size="sm">Get started</Button></Link>
        </div>
      </div>
    </header>
  );
}
