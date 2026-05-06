import Link from 'next/link';
import { Tile, Button } from '@perfin/ui';

export default function ConnectPage() {
  return (
    <Tile variant="hero" className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Bring in your data</h1>
        <p className="text-sm text-text-muted">
          Upload a recent statement to see Perfin in action. Bank connections (Plaid)
          and email forwarding are coming soon.
        </p>
      </header>
      <Link href="/app/upload"><Button size="lg" className="w-full">Upload a statement</Button></Link>
      <Link href="/app" className="block text-center text-sm text-text-muted">Skip for now</Link>
    </Tile>
  );
}
