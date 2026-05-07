import { Tile } from '@perfin/ui';

export default function ChangelogPage() {
  return (
    <section className="max-w-3xl mx-auto px-6 py-16 space-y-8">
      <h1 className="text-3xl font-semibold">Changelog</h1>
      <Tile className="space-y-2">
        <div className="flex items-center gap-2"><span className="text-xs text-text-subtle font-mono">v0.5</span><span className="font-semibold">SaaS launch</span></div>
        <p className="text-sm text-text-muted">Marketing site, Stripe billing, push notifications, PWA support. Perfin is ready for customers.</p>
      </Tile>
      <Tile className="space-y-2">
        <div className="flex items-center gap-2"><span className="text-xs text-text-subtle font-mono">v0.4</span><span className="font-semibold">Bank connections</span></div>
        <p className="text-sm text-text-muted">Plaid integration, Postmark email ingestion, encrypted access tokens, automated bank sync.</p>
      </Tile>
      <Tile className="space-y-2">
        <div className="flex items-center gap-2"><span className="text-xs text-text-subtle font-mono">v0.3</span><span className="font-semibold">Agent chat</span></div>
        <p className="text-sm text-text-muted">Conversational AI agent with tool use, proposal-based writes, and threaded chat history.</p>
      </Tile>
      <Tile className="space-y-2">
        <div className="flex items-center gap-2"><span className="text-xs text-text-subtle font-mono">v0.2</span><span className="font-semibold">Insights engine</span></div>
        <p className="text-sm text-text-muted">Recurring detection, anomaly alerts, KPIs, budgets, narrative generation.</p>
      </Tile>
      <Tile className="space-y-2">
        <div className="flex items-center gap-2"><span className="text-xs text-text-subtle font-mono">v0.1</span><span className="font-semibold">Core import</span></div>
        <p className="text-sm text-text-muted">CSV, Excel, PDF import. AI categorization. Transactions table and accounts management.</p>
      </Tile>
    </section>
  );
}
