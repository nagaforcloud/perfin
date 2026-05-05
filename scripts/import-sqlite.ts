/**
 * One-shot import: existing SQLite ledger -> new Postgres schema.
 *
 * Usage:
 *   DATABASE_URL=postgres://... \
 *   SQLITE_PATH=_legacy/ai_accountant/database/ledger.db \
 *   USER_EMAIL=you@example.com \
 *   pnpm --filter @perfin/scripts import-sqlite
 */
import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { createDb, users, accounts, transactions, budgets } from '@perfin/db';

const dbUrl = required('DATABASE_URL');
const sqlitePath = required('SQLITE_PATH');
const userEmail = required('USER_EMAIL');

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

interface SqliteAccount {
  name: string;
  bank: string;
  account_type: string;
  currency: string;
  color: string;
  created_at: string;
}

interface SqliteTxn {
  date: string;
  description: string;
  amount_cents: number;
  category: string;
  account: string;
  source_file: string | null;
  created_at: string;
  updated_at: string | null;
}

interface SqliteBudget {
  category: string;
  amount_cents: number;
  period: string;
  account: string;
}

async function main() {
  const sqlite = new Database(sqlitePath, { readonly: true });
  const { db, close } = createDb(dbUrl);

  // 1. User
  const [user] = await db
    .insert(users)
    .values({ email: userEmail, passwordHash: 'imported-set-password-via-reset' })
    .onConflictDoUpdate({ target: users.email, set: { email: userEmail } })
    .returning();
  if (!user) throw new Error('User upsert failed');
  console.log(`User: id=${user.id} email=${user.email}`);

  // 2. Accounts
  const sqliteAccounts = sqlite
    .prepare(`SELECT name, bank, account_type, currency, color, created_at FROM accounts`)
    .all() as SqliteAccount[];

  const accountIdByName = new Map<string, number>();
  for (const a of sqliteAccounts) {
    const [row] = await db
      .insert(accounts)
      .values({
        userId: user.id,
        name: a.name,
        bank: a.bank ?? '',
        type: a.account_type ?? 'checking',
        currency: a.currency ?? 'INR',
        color: a.color ?? '#6366f1',
      })
      .onConflictDoNothing()
      .returning();
    if (row) {
      accountIdByName.set(a.name, row.id);
    } else {
      const [existing] = await db.select().from(accounts).where(eq(accounts.name, a.name));
      if (existing) accountIdByName.set(a.name, existing.id);
    }
  }
  console.log(`Accounts imported: ${accountIdByName.size}`);

  // 3. Transactions
  const sqliteTxns = sqlite
    .prepare(
      `SELECT date, description, amount_cents, category, account, source_file,
              created_at, updated_at
       FROM transactions
       ORDER BY date`,
    )
    .all() as SqliteTxn[];

  const BATCH = 500;
  let imported = 0;
  for (let i = 0; i < sqliteTxns.length; i += BATCH) {
    const slice = sqliteTxns.slice(i, i + BATCH);
    const values = slice.map((t) => ({
      userId: user.id,
      accountId: accountIdByName.get(t.account) ?? null,
      date: t.date,
      description: t.description,
      rawDescription: t.description,
      amountCents: t.amount_cents,
      category: t.category ?? 'Needs Review',
      sourceFile: t.source_file,
    }));
    const inserted = await db
      .insert(transactions)
      .values(values)
      .onConflictDoNothing()
      .returning({ id: transactions.id });
    imported += inserted.length;
  }
  console.log(`Transactions imported: ${imported} / ${sqliteTxns.length}`);

  // 4. Budgets
  const sqliteBudgets = sqlite
    .prepare(`SELECT category, amount_cents, period, account FROM budgets`)
    .all() as SqliteBudget[];

  for (const b of sqliteBudgets) {
    await db
      .insert(budgets)
      .values({
        userId: user.id,
        category: b.category,
        amountCents: b.amount_cents,
        period: b.period ?? 'monthly',
        accountId: accountIdByName.get(b.account) ?? null,
      })
      .onConflictDoNothing();
  }
  console.log(`Budgets imported: ${sqliteBudgets.length}`);

  sqlite.close();
  await close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
