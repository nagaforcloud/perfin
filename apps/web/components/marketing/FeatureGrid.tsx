import { Tile } from '@perfin/ui';

const features = [
  { title: 'Drop in any statement', body: 'CSV, Excel, or PDF — Perfin extracts transactions and categorizes them in seconds.' },
  { title: 'AI you can audit', body: 'Every classification is rule-traceable. Every agent action goes through your approval, then into a log.' },
  { title: 'Recurring + anomaly built-in', body: 'Subscriptions, unusual charges, monthly drifts — surfaced before you notice them.' },
  { title: 'Ask anything', body: 'Conversational chat over your ledger. The agent uses tools, you see the calls, you approve writes.' },
  { title: 'Connect your bank', body: 'Plaid for North America, Europe, India. Or forward bank emails. Or upload — your call.' },
  { title: 'Yours forever', body: 'Local Postgres, encrypted access tokens, no data sale, full export. Fork the schema if you want.' },
];

export function FeatureGrid() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {features.map((f) => (
        <Tile key={f.title} className="space-y-2">
          <h3 className="font-semibold">{f.title}</h3>
          <p className="text-sm text-text-muted">{f.body}</p>
        </Tile>
      ))}
    </section>
  );
}
