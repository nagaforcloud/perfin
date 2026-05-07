import { describe, expect, it } from 'vitest';
import { buildServer } from '../src/server';

describe('POST /webhooks/postmark', () => {
  it('accepts (200) when no auth configured (dev)', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/postmark',
      payload: { ToFull: [{ Email: 'u_aaaa111111111111@in.perfin.app' }], From: 'unknown@x.com', Subject: 'x', TextBody: 'no match' },
    });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});
