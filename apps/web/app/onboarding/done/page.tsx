import Link from 'next/link';
import { Tile, Button } from '@perfin/ui';

export default function DonePage() {
  return (
    <Tile variant="hero" className="space-y-4 text-center">
      <h1 className="text-2xl font-semibold">You're all set.</h1>
      <p className="text-text-muted">
        Your transactions are categorized. The AI insights will start to fill in
        once we have ~30 days of activity.
      </p>
      <Link href="/app"><Button size="lg" className="w-full">Open my dashboard</Button></Link>
    </Tile>
  );
}
