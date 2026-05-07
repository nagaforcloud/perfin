'use client';

import { Tile, Button } from '@perfin/ui';
import { usePlan } from '@/hooks/usePlan';

export function BillingPanel() {
  const { data, isLoading } = usePlan();

  const handleCheckout = async (plan: 'plus' | 'pro') => {
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    const { url } = (await res.json()) as { url: string };
    window.location.href = url;
  };

  const handlePortal = async () => {
    const res = await fetch('/api/billing/portal', { method: 'POST' });
    const { url } = (await res.json()) as { url: string };
    window.location.href = url;
  };

  if (isLoading) return <div className="text-text-muted text-sm">Loading…</div>;

  const plan = (data?.plan ?? 'free') as 'free' | 'plus' | 'pro';
  const sub = data?.subscription;

  return (
    <Tile className="space-y-4">
      <h2 className="text-xl font-semibold">Billing</h2>
      <div className="flex items-center gap-3">
        <div className="text-2xl font-semibold capitalize">{plan}</div>
        {plan === 'free' && <span className="text-sm text-text-muted">— Free forever</span>}
        {sub?.status === 'active' && <span className="text-sm text-positive">Active</span>}
        {sub?.cancelAtPeriodEnd === 'true' && <span className="text-sm text-warning">Cancels at period end</span>}
        {sub?.currentPeriodEnd && (
          <span className="text-xs text-text-muted">
            Renews {new Date(sub.currentPeriodEnd).toLocaleDateString()}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {plan === 'free' && (
          <>
            <Button variant="primary" size="sm" onClick={() => handleCheckout('plus')}>Upgrade to Plus (₹299/mo)</Button>
            <Button variant="secondary" size="sm" onClick={() => handleCheckout('pro')}>Upgrade to Pro (₹999/mo)</Button>
          </>
        )}
        {plan === 'plus' && (
          <>
            <Button variant="primary" size="sm" onClick={() => handleCheckout('pro')}>Upgrade to Pro</Button>
            {data?.hasStripeCustomer && (
              <Button variant="ghost" size="sm" onClick={handlePortal}>Manage billing</Button>
            )}
          </>
        )}
        {plan === 'pro' && data?.hasStripeCustomer && (
          <Button variant="ghost" size="sm" onClick={handlePortal}>Manage billing</Button>
        )}
      </div>
    </Tile>
  );
}
