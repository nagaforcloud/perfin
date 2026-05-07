import Link from 'next/link';

export function MarketingFooter() {
  return (
    <footer className="border-t border-border py-12">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div>
          <div className="font-semibold mb-3">Perfin</div>
          <p className="text-text-muted">Your money, finally explained.</p>
        </div>
        <div>
          <div className="font-semibold mb-3">Product</div>
          <ul className="space-y-2">
            <li><Link href="/pricing" className="text-text-muted hover:text-text">Pricing</Link></li>
            <li><Link href="/how-it-works" className="text-text-muted hover:text-text">How it works</Link></li>
            <li><Link href="/changelog" className="text-text-muted hover:text-text">Changelog</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-3">Trust</div>
          <ul className="space-y-2">
            <li><Link href="/security" className="text-text-muted hover:text-text">Security</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-3">Get started</div>
          <ul className="space-y-2">
            <li><Link href="/signup" className="text-text-muted hover:text-text">Sign up</Link></li>
            <li><Link href="/login" className="text-text-muted hover:text-text">Log in</Link></li>
          </ul>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 mt-8 text-xs text-text-subtle">
        {'\u00A9'} Perfin · Built with Claude
      </div>
    </footer>
  );
}
