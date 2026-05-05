import { Tile } from '@perfin/ui';

export default function HomePage() {
  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-2xl font-semibold mb-6">Welcome.</h1>
      <Tile variant="hero">
        <p className="text-text-muted">
          Your dashboard will appear here once you've added some transactions.
          For now, this is the Phase 0 shell — sidebar, theme, auth all working.
        </p>
      </Tile>
    </div>
  );
}
