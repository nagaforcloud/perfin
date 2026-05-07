'use client';

import { Tile, Button } from '@perfin/ui';
import { usePushSubscription } from '@/hooks/usePushSubscription';

export function NotificationsPanel() {
  const { subscribed, subscribe } = usePushSubscription();

  return (
    <Tile className="space-y-4">
      <h2 className="text-xl font-semibold">Notifications</h2>
      <p className="text-sm text-text-muted">
        Get push notifications when new transactions arrive, when the agent has a proposal, or when anomalies are detected.
      </p>
      {subscribed
        ? <div className="text-sm text-positive">Push notifications enabled</div>
        : (
          <Button variant="primary" size="sm" onClick={subscribe}>
            Enable push notifications
          </Button>
        )}
    </Tile>
  );
}
