import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDb } from '@perfin/db';
import { syncOnePlaidConnection } from '../src/lib/plaid-sync';

const skipIfNoDb = process.env.SKIP_DB_TESTS === '1';

describe('syncOnePlaidConnection error handling', () => {
  it('throws for non-existent connection', async () => {
    const url = process.env.DATABASE_URL ?? 'postgres://perfin:perfin@localhost:5433/perfin';
    const { db, close } = createDb(url);
    try {
      await expect(syncOnePlaidConnection({ db, connectionId: 999999 }))
        .rejects.toThrow('connection 999999 not found');
    } finally {
      await close();
    }
  });

  it('throws for non-plaid connection', async () => {
    const url = process.env.DATABASE_URL ?? 'postgres://perfin:perfin@localhost:5433/perfin';
    const { db, close } = createDb(url);

    // Create a non-plaid connection
    const { connections } = await import('@perfin/db');
    const [conn] = await db.insert(connections).values({
      userId: '1',
      provider: 'manual',
      status: 'active',
    }).returning();

    try {
      await expect(syncOnePlaidConnection({ db, connectionId: conn.id }))
        .rejects.toThrow(/not plaid/);
    } finally {
      await db.delete(connections).where(eq(connections.id, conn.id));
      await close();
    }
  });
});
