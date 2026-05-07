'use client';

import { useEffect, useState } from 'react';
import { usePlaidLink, type PlaidLinkOnSuccess } from 'react-plaid-link';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@perfin/ui';
import { apiFetch } from '@/lib/api';

export function PlaidLinkButton() {
  const qc = useQueryClient();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ linkToken: string }>('/api/connections/plaid/link-token', { method: 'POST' })
      .then(({ linkToken }) => setLinkToken(linkToken))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  const onSuccess: PlaidLinkOnSuccess = async (publicToken: string) => {
    try {
      await apiFetch('/api/connections/plaid/exchange', { method: 'POST', body: JSON.stringify({ publicToken }) });
      qc.invalidateQueries({ queryKey: ['connections'] });
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };

  const { open, ready } = usePlaidLink({ token: linkToken ?? '', onSuccess });

  if (err) return <div className="text-sm text-negative">{err}</div>;
  if (!linkToken) return <Button disabled>Loading…</Button>;
  return <Button onClick={() => open()} disabled={!ready}>Connect a bank</Button>;
}
