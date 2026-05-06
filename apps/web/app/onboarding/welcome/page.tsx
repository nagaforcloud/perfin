import Link from 'next/link';
import { Tile, Button } from '@perfin/ui';

export default function WelcomePage() {
  return (
    <Tile variant="hero" className="space-y-4 text-center">
      <h1 className="text-2xl font-semibold">Welcome to Perfin</h1>
      <p className="text-text-muted">
        Let's get you set up. This takes about a minute.
      </p>
      <Link href="/onboarding/locale"><Button size="lg" className="w-full">Get started</Button></Link>
    </Tile>
  );
}
