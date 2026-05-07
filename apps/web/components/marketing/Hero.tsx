import Link from 'next/link';
import { Button } from '@perfin/ui';

export function Hero() {
  return (
    <section className="max-w-4xl mx-auto px-6 py-24 text-center space-y-6">
      <h1 className="text-5xl md:text-6xl font-semibold tracking-tight">
        Your money, <span className="text-accent">finally explained</span>.
      </h1>
      <p className="text-lg text-text-muted max-w-2xl mx-auto">
        Perfin imports every transaction, categorizes it with AI, and tells you what is actually happening.
        Ask it questions. Let it propose changes. You stay in control.
      </p>
      <div className="flex justify-center gap-3 pt-2">
        <Link href="/signup"><Button variant="primary" size="lg">Get started — free</Button></Link>
        <Link href="#demo"><Button variant="secondary" size="lg">Try the demo</Button></Link>
      </div>
    </section>
  );
}
