import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export function createDb(url: string): { db: Db; close: () => Promise<void> } {
  const client = postgres(url, { max: 10, prepare: false });
  const db = drizzle(client, { schema });
  return {
    db,
    close: async () => { await client.end(); },
  };
}
