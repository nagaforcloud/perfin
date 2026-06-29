import { describe, expect, it } from 'vitest';
import { regenerateForUser } from '../src/lib/regenerate';

describe('regenerateForUser', () => {
  it('returns a summary with counts (uses provided in-memory db)', async () => {
    const stub = makeStubDb();
    const out = await regenerateForUser({ userId: '1', db: stub.db, currency: 'INR' });
    expect(out).toHaveProperty('insightCount');
    expect(out).toHaveProperty('anomalyCount');
    expect(out).toHaveProperty('recurringCount');
  });
});

function makeStubDb() {
  const select = () => ({ from: () => ({ where: async () => [] }) });
  const insert = () => ({ values: () => ({ onConflictDoNothing: () => ({ returning: async () => [] }) }) });
  const del = () => ({ where: async () => undefined });
  const db = { select, insert, delete: del } as unknown as Parameters<typeof regenerateForUser>[0]['db'];
  return { db };
}
