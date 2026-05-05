import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createDb, type Db } from '../src/client';
import { users } from '../src/schema/index';

const url = process.env.DATABASE_URL ?? 'postgres://perfin:perfin@localhost:5432/perfin';
const skipIfNoDb = process.env.SKIP_DB_TESTS === '1';
let db: Db;
let closeDb: () => Promise<void>;

beforeAll(async () => {
  if (skipIfNoDb) return;
  const created = createDb(url);
  db = created.db;
  closeDb = created.close;
});

afterAll(async () => {
  if (skipIfNoDb) return;
  await db.delete(users).where(eq(users.email, 'smoke@perfin.dev'));
  await closeDb();
});

describe.skipIf(skipIfNoDb)('db client', () => {
  it('inserts and selects a user', async () => {
    const [inserted] = await db
      .insert(users)
      .values({ email: 'smoke@perfin.dev', passwordHash: 'x' })
      .returning();
    expect(inserted?.id).toBeGreaterThan(0);
    expect(inserted?.plan).toBe('free');

    const [found] = await db.select().from(users).where(eq(users.email, 'smoke@perfin.dev'));
    expect(found?.id).toBe(inserted?.id);
  });
});
