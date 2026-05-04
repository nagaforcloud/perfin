import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { centsToRupees, rupeesToCents } from './shared/amount.js';

export interface AccountRow {
  id: number;
  name: string;
  bank: string;
  account_type: string;
  currency: string;
  color: string;
  created_at: string;
  transaction_count?: number;
  total_income?: number;
  total_expenses?: number;
}

export interface TransactionRow {
  id: number;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  account: string;
  source_file: string | null;
  created_at: string;
  updated_at: string | null;
}

interface TxnDBRow {
  id: number;
  date: string;
  description: string;
  amount_cents: number;
  category: string;
  account: string;
  source_file: string | null;
  created_at: string;
  updated_at: string | null;
}

const CREATE_ACCOUNTS = `
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  bank TEXT DEFAULT '',
  account_type TEXT DEFAULT 'checking',
  currency TEXT DEFAULT 'INR',
  color TEXT DEFAULT '#6366f1',
  created_at TEXT NOT NULL
);`;

const CREATE_TXNS = `
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  category TEXT DEFAULT 'Needs Review',
  account TEXT DEFAULT 'Unknown',
  source_file TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  UNIQUE(date, description, amount_cents, source_file)
);`;

const CREATE_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_amount_cents ON transactions(amount_cents);
CREATE INDEX IF NOT EXISTS idx_description ON transactions(description);
CREATE INDEX IF NOT EXISTS idx_source_file ON transactions(source_file);
CREATE INDEX IF NOT EXISTS idx_account ON transactions(account);`;

const CREATE_BUDGETS = `
CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly',
  account TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(category, period, account)
);`;

const CREATE_BUDGET_INDEX = `
CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(category);`;

const CREATE_USERS = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);`;

// Migration: add user_id columns to existing tables (idempotent)
const MIGRATE_USER_ID = [
  `ALTER TABLE transactions ADD COLUMN user_id INTEGER DEFAULT 1`,
  `ALTER TABLE accounts ADD COLUMN user_id INTEGER DEFAULT 1`,
  `ALTER TABLE budgets ADD COLUMN user_id INTEGER DEFAULT 1`,
];

const SEED_DEFAULT_USER = `
INSERT OR IGNORE INTO users (id, email, password_hash, created_at)
VALUES (1, 'local@perfin.dev', '', datetime('now'));`;

export class Ledger {
  private db: Database.Database;

  constructor(dbPath: string = config.databasePath) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('cache_size = 10000');
    this.db.exec(CREATE_ACCOUNTS);
    this.db.exec(CREATE_TXNS);
    this.db.exec(CREATE_INDEXES);
    this.db.exec(CREATE_BUDGETS);
    this.db.exec(CREATE_BUDGET_INDEX);
    this.db.exec(CREATE_USERS);
    this.db.exec(SEED_DEFAULT_USER);

    // Idempotent migrations — ignore "duplicate column" errors
    for (const sql of MIGRATE_USER_ID) {
      try { this.db.exec(sql); } catch { /* column already exists */ }
    }
  }

  close(): void {
    this.db.close();
  }

  // ─── Users ──────────────────────────────────────────────────────────

  getUserByEmail(email: string): UserRow | null {
    const row = this.db
      .prepare('SELECT id, email, password_hash, created_at FROM users WHERE email = ?')
      .get(email) as UserRow | undefined;
    return row ?? null;
  }

  getUserById(id: number): UserRow | null {
    const row = this.db
      .prepare('SELECT id, email, password_hash, created_at FROM users WHERE id = ?')
      .get(id) as UserRow | undefined;
    return row ?? null;
  }

  createUser(email: string, passwordHash: string): UserRow {
    const now = new Date().toISOString();
    this.db
      .prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)')
      .run(email, passwordHash, now);
    return this.getUserByEmail(email)!;
  }

  // ─── Accounts ────────────────────────────────────────────────────────────

  getAccounts(userId: number = 1): AccountRow[] {
    const sql = `
      SELECT
        a.id, a.name, a.bank, a.account_type, a.currency, a.color, a.created_at,
        COUNT(t.id) AS transaction_count,
        SUM(CASE WHEN t.amount_cents > 0 THEN t.amount_cents ELSE 0 END) AS income_cents,
        SUM(CASE WHEN t.amount_cents < 0 THEN ABS(t.amount_cents) ELSE 0 END) AS expense_cents
      FROM accounts a
      LEFT JOIN transactions t ON t.account = a.name AND t.user_id = a.user_id
      WHERE a.user_id = ?
      GROUP BY a.id
      ORDER BY a.created_at
    `;
    const rows = this.db.prepare(sql).all(userId) as Array<AccountRow & {
      income_cents: number | null;
      expense_cents: number | null;
    }>;
    return rows.map(({ income_cents, expense_cents, ...rest }) => ({
      ...rest,
      total_income: centsToRupees(income_cents ?? 0),
      total_expenses: centsToRupees(expense_cents ?? 0),
    }));
  }

  getAccountByName(name: string): AccountRow | null {
    const row = this.db
      .prepare('SELECT id, name, bank, account_type, currency, color, created_at FROM accounts WHERE name = ?')
      .get(name) as AccountRow | undefined;
    return row ?? null;
  }

  createAccount(input: {
    name: string;
    bank?: string;
    account_type?: string;
    currency?: string;
    color?: string;
  }, userId: number = 1): AccountRow {
    const now = new Date().toISOString();
    this.db
      .prepare(`
        INSERT OR IGNORE INTO accounts (name, bank, account_type, currency, color, user_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        input.name,
        input.bank ?? '',
        input.account_type ?? 'checking',
        input.currency ?? 'INR',
        input.color ?? '#6366f1',
        userId,
        now,
      );
    const account = this.getAccountByName(input.name);
    if (!account) throw new Error(`Account '${input.name}' failed to create`);
    return account;
  }

  updateAccount(name: string, patch: Record<string, unknown>): boolean {
    const allowed = ['bank', 'account_type', 'currency', 'color'] as const;
    const entries = Object.entries(patch).filter(([k]) => (allowed as readonly string[]).includes(k));
    if (entries.length === 0) return false;
    const setClause = entries.map(([k]) => `${k} = ?`).join(', ');
    const values = entries.map(([, v]) => v);
    const result = this.db
      .prepare(`UPDATE accounts SET ${setClause} WHERE name = ?`)
      .run(...values, name);
    return result.changes > 0;
  }

  deleteAccount(name: string): boolean {
    const tx = this.db.transaction((accountName: string) => {
      const exists = this.db.prepare('SELECT id FROM accounts WHERE name = ?').get(accountName);
      if (!exists) return false;
      this.db.prepare(`UPDATE transactions SET account = '' WHERE account = ?`).run(accountName);
      this.db.prepare('DELETE FROM accounts WHERE name = ?').run(accountName);
      return true;
    });
    return tx(name);
  }

  // ─── Transactions ────────────────────────────────────────────────────────

  private toDomain(row: TxnDBRow): TransactionRow {
    const amount = centsToRupees(row.amount_cents);
    return {
      id: row.id,
      date: row.date,
      description: row.description,
      amount,
      type: amount >= 0 ? 'income' : 'expense',
      category: row.category,
      account: row.account,
      source_file: row.source_file,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  listTransactions(filters: {
    account?: string;
    category?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
    type?: 'income' | 'expense';
  }, userId: number = 1): TransactionRow[] {
    const where: string[] = ['t.user_id = ?'];
    const params: unknown[] = [userId];

    if (filters.start_date) { where.push('date >= ?'); params.push(filters.start_date); }
    if (filters.end_date) { where.push('date <= ?'); params.push(filters.end_date); }
    if (filters.category) { where.push('category = ?'); params.push(filters.category); }
    if (filters.account) { where.push('account = ?'); params.push(filters.account); }
    if (filters.type === 'income') where.push('amount_cents > 0');
    if (filters.type === 'expense') where.push('amount_cents < 0');
    if (filters.search) {
      where.push('(LOWER(description) LIKE ? OR LOWER(category) LIKE ?)');
      const needle = `%${filters.search.toLowerCase()}%`;
      params.push(needle, needle);
    }

    const sql = `
      SELECT id, date, description, amount_cents, category, account, source_file, created_at, updated_at
      FROM transactions
      WHERE ${where.join(' AND ')}
      ORDER BY date DESC, id DESC
    `;
    const rows = this.db.prepare(sql).all(...params) as TxnDBRow[];
    return rows.map(r => this.toDomain(r));
  }

  getTransaction(id: number): TransactionRow | null {
    const row = this.db
      .prepare(`
        SELECT id, date, description, amount_cents, category, account, source_file, created_at, updated_at
        FROM transactions WHERE id = ?
      `)
      .get(id) as TxnDBRow | undefined;
    return row ? this.toDomain(row) : null;
  }

  updateTransaction(id: number, patch: { category?: string; description?: string }): boolean {
    const entries: Array<[string, unknown]> = [];
    if (patch.category !== undefined) entries.push(['category', patch.category]);
    if (patch.description !== undefined) entries.push(['description', patch.description]);
    if (entries.length === 0) return false;
    entries.push(['updated_at', new Date().toISOString()]);
    const setClause = entries.map(([k]) => `${k} = ?`).join(', ');
    const values = entries.map(([, v]) => v);
    const result = this.db
      .prepare(`UPDATE transactions SET ${setClause} WHERE id = ?`)
      .run(...values, id);
    return result.changes > 0;
  }

  deleteTransaction(id: number): boolean {
    return this.db.prepare('DELETE FROM transactions WHERE id = ?').run(id).changes > 0;
  }

  deleteTransactionsBulk(ids: number[]): number {
    if (ids.length === 0) return 0;
    const placeholders = ids.map(() => '?').join(',');
    return this.db.prepare(`DELETE FROM transactions WHERE id IN (${placeholders})`).run(...ids).changes;
  }

  insertTransactions(
    txns: Array<{ date: string; description: string; amount: number; category?: string; account?: string }>,
    sourceFile: string | null,
    userId: number = 1,
  ): number {
    if (txns.length === 0) return 0;
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO transactions
        (date, description, amount_cents, category, account, source_file, user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const now = new Date().toISOString();
    const insertMany = this.db.transaction((rows: typeof txns) => {
      let n = 0;
      for (const t of rows) {
        const result = stmt.run(
          t.date,
          t.description,
          rupeesToCents(t.amount),
          t.category ?? 'Needs Review',
          t.account ?? 'Unknown',
          sourceFile,
          userId,
          now,
        );
        n += result.changes;
      }
      return n;
    });
    return insertMany(txns);
  }

  listCategoriesInUse(): string[] {
    const rows = this.db
      .prepare(`SELECT DISTINCT category FROM transactions WHERE category IS NOT NULL ORDER BY category`)
      .all() as Array<{ category: string }>;
    return rows.map(r => r.category);
  }

  // ─── Budgets ──────────────────────────────────────────────────────────

  listBudgets(account?: string, userId: number = 1): BudgetRow[] {
    const where = account ? 'WHERE (account = ? OR account = \'\') AND user_id = ?' : 'WHERE user_id = ?';
    const params: unknown[] = account ? [account, userId] : [userId];
    const rows = this.db
      .prepare(`SELECT id, category, amount_cents, period, account, created_at, updated_at FROM budgets ${where} ORDER BY category`)
      .all(...params) as BudgetDBRow[];
    return rows.map(r => ({ ...r, amount: centsToRupees(r.amount_cents) }));
  }

  getBudget(id: number): BudgetRow | null {
    const row = this.db
      .prepare('SELECT id, category, amount_cents, period, account, created_at, updated_at FROM budgets WHERE id = ?')
      .get(id) as BudgetDBRow | undefined;
    return row ? { ...row, amount: centsToRupees(row.amount_cents) } : null;
  }

  upsertBudget(input: { category: string; amount: number; period?: string; account?: string }, userId: number = 1): BudgetRow {
    const now = new Date().toISOString();
    const amountCents = rupeesToCents(input.amount);
    this.db
      .prepare(`
        INSERT INTO budgets (category, amount_cents, period, account, user_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(category, period, account) DO UPDATE SET
          amount_cents = excluded.amount_cents,
          updated_at = excluded.updated_at
      `)
      .run(input.category, amountCents, input.period ?? 'monthly', input.account ?? '', userId, now, now);
    return this.db
      .prepare('SELECT id, category, amount_cents, period, account, created_at, updated_at FROM budgets WHERE category = ? AND period = ? AND account = ?')
      .get(input.category, input.period ?? 'monthly', input.account ?? '') as BudgetRow;
  }

  deleteBudget(id: number): boolean {
    return this.db.prepare('DELETE FROM budgets WHERE id = ?').run(id).changes > 0;
  }

  /**
   * Current month spend per category vs budget.
   * Returns each category with its budget amount and actual spend.
   */
  getBudgetStatus(account?: string, userId: number = 1): BudgetStatusRow[] {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const accountFilter = account ? 'AND (t.account = ? OR t.account = \'\')' : '';
    const params: (string | number)[] = [monthStart, userId];
    if (account) params.push(account);

    const rows = this.db
      .prepare(`
        SELECT
          b.category,
          b.amount_cents AS budget_cents,
          COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN ABS(t.amount_cents) ELSE 0 END), 0) AS spent_cents
        FROM budgets b
        LEFT JOIN transactions t ON t.category = b.category AND t.date >= ? AND t.user_id = b.user_id
          ${accountFilter}
        WHERE b.user_id = ?
        GROUP BY b.category, b.amount_cents
        ORDER BY b.category
      `)
      .all(...params) as Array<{ category: string; budget_cents: number; spent_cents: number }>;

    return rows.map(r => ({
      category: r.category,
      budget: centsToRupees(r.budget_cents),
      spent: centsToRupees(r.spent_cents),
    }));
  }
}

// ─── Budget types ────────────────────────────────────────────────────────────

interface BudgetDBRow {
  id: number;
  category: string;
  amount_cents: number;
  period: string;
  account: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetRow {
  id: number;
  category: string;
  amount: number;
  period: string;
  account: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetStatusRow {
  category: string;
  budget: number;
  spent: number;
}

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  created_at: string;
}
