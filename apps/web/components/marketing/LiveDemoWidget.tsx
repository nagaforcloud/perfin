'use client';

import { useState } from 'react';
import { Tile, Button, Badge } from '@perfin/ui';
import { SEED_RULES, formatCurrency } from '@perfin/core';

export function LiveDemoWidget() {
  const [rows, setRows] = useState<Array<{ description: string; amount: number; category: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [ran, setRan] = useState(false);

  async function run() {
    setBusy(true);
    const demoRows = [
      { description: 'Swiggy Bangalore', amount: -450 },
      { description: 'Salary Acme Corp', amount: 80000 },
      { description: 'Uber ride', amount: -220.5 },
      { description: 'Netflix monthly', amount: -649 },
      { description: 'Amazon.in order', amount: -1299 },
      { description: 'Electricity bill', amount: -2340 },
    ];
    const out = demoRows.map((r) => {
      const cat = SEED_RULES.find((rule) =>
        rule.matchType === 'contains' && r.description.toLowerCase().includes(rule.pattern.toLowerCase()),
      );
      return { ...r, category: cat?.category ?? 'Other' };
    });
    // Simulate AI latency
    await new Promise((r) => setTimeout(r, 600));
    setRows(out);
    setBusy(false);
    setRan(true);
  }

  return (
    <section id="demo" className="max-w-3xl mx-auto px-6 py-16">
      <Tile className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Try it — no signup required</h2>
          <Button variant="primary" size="sm" disabled={busy} onClick={run}>
            {busy ? 'Categorizing…' : ran ? 'Re-run' : 'Run demo'}
          </Button>
        </div>
        {rows.length === 0
          ? <p className="text-sm text-text-muted">Click Run demo to see AI categorization on sample transactions.</p>
          : (
            <div className="space-y-1">
              {rows.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-text-muted">{r.description}</span>
                    <Badge>{r.category}</Badge>
                  </div>
                  <span className="font-mono font-medium">{formatCurrency(Math.round(r.amount * 100), 'INR')}</span>
                </div>
              ))}
            </div>
          )}
      </Tile>
    </section>
  );
}
