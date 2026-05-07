import Link from 'next/link';
import { Tile, Button } from '@perfin/ui';

const plans = [
  {
    name: 'Free',
    price: '₹0',
    period: 'forever',
    features: ['Unlimited manual uploads', 'AI categorization (basic)', 'Agent — 30 queries/mo', 'Dashboard + insights', 'Export CSV'],
    cta: 'Get started',
    href: '/signup',
    variant: 'secondary' as const,
  },
  {
    name: 'Plus',
    price: '₹299',
    period: '/mo',
    features: ['Everything in Free', 'Plaid connections (unlimited)', 'Unlimited transactions', 'Agent — 200 queries/mo', 'Excel export', 'Priority support'],
    cta: 'Start free trial',
    href: '/signup?plan=plus',
    variant: 'primary' as const,
    highlight: true,
  },
  {
    name: 'Pro',
    price: '₹999',
    period: '/mo',
    features: ['Everything in Plus', 'Unlimited agent queries', 'Multi-member household', 'PDF report generation', 'Custom categories', 'Priority AI features'],
    cta: 'Start free trial',
    href: '/signup?plan=pro',
    variant: 'secondary' as const,
  },
];

export function PricingTable() {
  return (
    <section className="max-w-5xl mx-auto px-6 py-16">
      <h2 className="text-2xl font-semibold text-center mb-2">Simple, transparent pricing</h2>
      <p className="text-sm text-text-muted text-center mb-10">14-day free trial on all paid plans. Cancel anytime.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((p) => (
          <Tile key={p.name} className={`space-y-4 ${p.highlight ? 'border-accent ring-1 ring-accent' : ''}`}>
            <div>
              <h3 className="font-semibold text-lg">{p.name}</h3>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-3xl font-semibold">{p.price}</span>
                <span className="text-sm text-text-muted">{p.period}</span>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-text-muted">
              {p.features.map((f) => <li key={f}>{'\u2713'} {f}</li>)}
            </ul>
            <Link href={p.href}><Button variant={p.variant} className="w-full">{p.cta}</Button></Link>
          </Tile>
        ))}
      </div>
    </section>
  );
}
