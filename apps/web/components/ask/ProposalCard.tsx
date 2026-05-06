'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Tile } from '@perfin/ui';
import { apiFetch } from '@/lib/api';

export interface ProposalCardProps {
  proposalId: number;
  tool: string;
  preview: string;
  onConfirmed?: (output: unknown) => void;
}

export function ProposalCard({ proposalId, tool, preview, onConfirmed }: ProposalCardProps) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<'pending' | 'confirmed' | 'cancelled'>('pending');

  if (decision !== 'pending') {
    return (
      <Tile className="text-sm text-text-muted">
        {decision === 'confirmed' ? '\u2713 Applied' : '\u2715 Cancelled'} — <span className="font-mono text-xs">{tool}</span>
      </Tile>
    );
  }

  const confirm = async () => {
    setBusy(true);
    try {
      const out = await apiFetch<{ ok: boolean; output: unknown }>(`/api/agent/proposals/${proposalId}/confirm`, { method: 'POST' });
      setDecision('confirmed');
      onConfirmed?.(out.output);
      qc.invalidateQueries();
    } finally { setBusy(false); }
  };
  const cancel = async () => {
    setBusy(true);
    try {
      await apiFetch<{ ok: boolean }>(`/api/agent/proposals/${proposalId}/cancel`, { method: 'POST' });
      setDecision('cancelled');
    } finally { setBusy(false); }
  };

  return (
    <Tile variant="raised" className="space-y-3">
      <div className="text-xs uppercase tracking-wider font-semibold text-accent">Proposed change</div>
      <div className="text-sm text-text">{preview}</div>
      <div className="text-xs text-text-subtle font-mono">{tool}</div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" variant="primary" onClick={confirm} disabled={busy}>
          {busy ? 'Applying…' : '\u2713 Confirm'}
        </Button>
        <Button size="sm" variant="ghost" onClick={cancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </Tile>
  );
}
