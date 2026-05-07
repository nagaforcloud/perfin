import { describe, expect, it } from 'vitest';
import { buildServer } from '../src/server';

describe('POST /webhooks/plaid (sandbox)', () => {
  it('accepts a TRANSACTIONS_SYNC_UPDATES_AVAILABLE event', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/plaid',
      headers: { 'content-type': 'application/json' },
      payload: { webhook_type: 'TRANSACTIONS', webhook_code: 'SYNC_UPDATES_AVAILABLE', item_id: 'i-unknown' },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});
