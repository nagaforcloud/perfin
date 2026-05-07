import { Tile } from '@perfin/ui';

const steps = [
  { step: '1', title: 'Sign up', body: 'Create an account in 30 seconds. No credit card required for the Free plan.' },
  { step: '2', title: 'Connect a source', body: 'Upload a statement, connect Plaid, or forward bank email alerts. You choose what to share.' },
  { step: '3', title: 'Watch it categorize', body: 'Perfin reads your data, cleans it, and classifies every line with deterministic rules + AI.' },
  { step: '4', title: 'Ask questions', body: 'Use the chat agent like a co-pilot. It uses tools, proposes actions, and you approve.' },
  { step: '5', title: 'Get proactive', body: 'Recurring subscription detection, anomaly alerts, budget tracking, and drift reports — all automatic.' },
];

export function HowItWorksSteps() {
  return (
    <section className="max-w-3xl mx-auto px-6 py-16 space-y-4">
      <h2 className="text-2xl font-semibold text-center mb-8">How it works</h2>
      {steps.map((s) => (
        <Tile key={s.step} className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-accent-soft text-accent font-semibold flex items-center justify-center shrink-0">
            {s.step}
          </div>
          <div>
            <h3 className="font-semibold">{s.title}</h3>
            <p className="text-sm text-text-muted">{s.body}</p>
          </div>
        </Tile>
      ))}
    </section>
  );
}
