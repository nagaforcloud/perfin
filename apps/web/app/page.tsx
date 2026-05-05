import Link from 'next/link';
import { Button } from '@perfin/ui';

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-semibold tracking-tight">
        Your money, finally explained.
      </h1>
      <p className="text-text-muted text-center max-w-md">
        Coming soon. Phase 0 placeholder.
      </p>
      <div className="flex gap-3">
        <Link href="/signup">
          <Button variant="primary">Sign up</Button>
        </Link>
        <Link href="/login">
          <Button variant="secondary">Log in</Button>
        </Link>
      </div>
    </main>
  );
}
