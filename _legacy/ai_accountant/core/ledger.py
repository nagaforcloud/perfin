"""
SQLite Ledger Database Module.

Provides persistent storage for all financial transactions with support for:
- Transaction insertion and updates
- Category management
- Querying and filtering
- Uncategorized transaction tracking

CRITICAL FIXES APPLIED:
- UNIQUE constraint on (date, description, amount_cents, source_file)
- INTEGER storage for currency (cents) instead of REAL
- Transaction wrapping for atomic operations
- SQLite WAL mode for performance
"""

import sqlite3
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from contextlib import contextmanager
import logging
from decimal import Decimal, ROUND_HALF_UP

from .config import Config

logger = logging.getLogger(__name__)

# Currency conversion constants
CENTS_PER_DOLLAR = 100


def dollars_to_cents(amount: float) -> int:
    """
    Convert dollar amount to integer cents.
    
    Args:
        amount: Amount in dollars (e.g., 123.45)
    
    Returns:
        Amount in cents (e.g., 12345)
    """
    # Use Decimal for precise conversion
    decimal_amount = Decimal(str(amount))
    cents = int((decimal_amount * CENTS_PER_DOLLAR).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
    return cents


def cents_to_dollars(cents: int) -> float:
    """
    Convert integer cents to dollar amount.
    
    Args:
        cents: Amount in cents (e.g., 12345)
    
    Returns:
        Amount in dollars (e.g., 123.45)
    """
    return cents / CENTS_PER_DOLLAR


class Ledger:
    """
    SQLite-based ledger for storing and managing financial transactions.

    The ledger provides ACID-compliant storage with efficient indexing
    for common query patterns. All transactions are stored with their
    original source information for auditability.

    Table Schema:
    - id: Primary key
    - date: Transaction date (TEXT ISO format)
    - description: Transaction description/merchant (TEXT)
    - amount_cents: Signed amount in cents (INTEGER, negative=debit, positive=credit)
    - category: Assigned category (TEXT)
    - account: Source account (TEXT)
    - source_file: Original PDF filename (TEXT)
    - created_at: Record creation timestamp (TEXT)
    - updated_at: Record update timestamp (TEXT)
    
    UNIQUE constraint: (date, description, amount_cents, source_file)
    """

    # SQL for creating the accounts table (multi-account support)
    CREATE_ACCOUNTS_TABLE_SQL = """
    CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        bank TEXT DEFAULT '',
        account_type TEXT DEFAULT 'checking',
        currency TEXT DEFAULT 'INR',
        color TEXT DEFAULT '#6366f1',
        created_at TEXT NOT NULL
    );
    """

    # SQL for creating the transactions table with INTEGER cents and UNIQUE constraint
    CREATE_TABLE_SQL = """
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
    );
    """

    # Index creation SQL for common query patterns
    CREATE_INDEX_SQL = """
    CREATE INDEX IF NOT EXISTS idx_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_category ON transactions(category);
    CREATE INDEX IF NOT EXISTS idx_amount_cents ON transactions(amount_cents);
    CREATE INDEX IF NOT EXISTS idx_description ON transactions(description);
    CREATE INDEX IF NOT EXISTS idx_source_file ON transactions(source_file);
    CREATE INDEX IF NOT EXISTS idx_account ON transactions(account);
    """

    # SQLite performance optimizations (WAL mode)
    PRAGMA_SQL = """
    PRAGMA journal_mode=WAL;
    PRAGMA synchronous=NORMAL;
    PRAGMA temp_store=MEMORY;
    PRAGMA cache_size=10000;
    """

    def __init__(self, config: Optional[Config] = None):
        """
        Initialize the ledger database.

        Args:
            config: Configuration object. Uses default if not provided.
        """
        self.config = config or Config()
        self.db_path = self.config.database_path

        # Initialize database
        self._initialize_database()

        logger.info(f"Ledger initialized at {self.db_path}")

    def _initialize_database(self):
        """Create database and tables if they don't exist with performance optimizations."""
        with self._get_connection() as conn:
            # Apply performance pragmas
            conn.executescript(self.PRAGMA_SQL)

            # Create accounts table first (transactions may reference it)
            conn.executescript(self.CREATE_ACCOUNTS_TABLE_SQL)

            # Create transactions table and indexes
            conn.executescript(self.CREATE_TABLE_SQL)
            conn.executescript(self.CREATE_INDEX_SQL)
            conn.commit()

        logger.debug("Database tables, indexes, and WAL mode initialized")

    # =========================================================================
    # Account management
    # =========================================================================

    def create_account(
        self,
        name: str,
        bank: str = "",
        account_type: str = "checking",
        currency: str = "INR",
        color: str = "#6366f1"
    ) -> Dict[str, Any]:
        """
        Create a new account (or return existing one with the same name).

        Args:
            name: Account display name (unique)
            bank: Bank name
            account_type: checking / savings / credit / investment
            currency: ISO currency code
            color: Hex colour for UI display

        Returns:
            Account dictionary
        """
        now = datetime.now().isoformat()
        sql = """
        INSERT OR IGNORE INTO accounts (name, bank, account_type, currency, color, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """
        with self._get_connection() as conn:
            with self._transaction(conn):
                conn.execute(sql, (name, bank, account_type, currency, color, now))

        return self.get_account_by_name(name)

    def get_accounts(self) -> List[Dict[str, Any]]:
        """Return all accounts with their transaction counts and totals."""
        sql = """
        SELECT
            a.id, a.name, a.bank, a.account_type, a.currency, a.color, a.created_at,
            COUNT(t.id)                                              AS transaction_count,
            SUM(CASE WHEN t.amount_cents > 0 THEN t.amount_cents ELSE 0 END) AS income_cents,
            SUM(CASE WHEN t.amount_cents < 0 THEN ABS(t.amount_cents) ELSE 0 END) AS expense_cents
        FROM accounts a
        LEFT JOIN transactions t ON t.account = a.name
        GROUP BY a.id
        ORDER BY a.created_at
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql)
            rows = cursor.fetchall()

        result = []
        for row in rows:
            d = dict(row)
            d['total_income'] = cents_to_dollars(d.pop('income_cents', 0) or 0)
            d['total_expenses'] = cents_to_dollars(d.pop('expense_cents', 0) or 0)
            result.append(d)
        return result

    def get_account_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Return a single account by name, or None."""
        sql = "SELECT id, name, bank, account_type, currency, color, created_at FROM accounts WHERE name = ?"
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, (name,))
            row = cursor.fetchone()
        return dict(row) if row else None

    def update_account(self, name: str, **kwargs) -> bool:
        """Update account metadata fields (bank, account_type, currency, color)."""
        allowed = {'bank', 'account_type', 'currency', 'color'}
        updates = {k: v for k, v in kwargs.items() if k in allowed}
        if not updates:
            return False
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        sql = f"UPDATE accounts SET {set_clause} WHERE name = ?"
        with self._get_connection() as conn:
            with self._transaction(conn):
                cursor = conn.cursor()
                cursor.execute(sql, list(updates.values()) + [name])
                return cursor.rowcount > 0

    @contextmanager
    def _get_connection(self):
        """
        Context manager for database connections.

        Yields:
            sqlite3.Connection object
        """
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # Enable dict-like access
        try:
            yield conn
        finally:
            # Switch back to DELETE journal mode before closing so that WAL
            # checkpoint files are written and the -wal/-shm files are removed.
            # This avoids disk I/O errors when tests delete the temp directory
            # immediately after the connection closes.
            try:
                conn.execute("PRAGMA journal_mode=DELETE")
            except Exception:
                pass
            conn.close()

    @contextmanager
    def _transaction(self, conn: sqlite3.Connection):
        """
        Context manager for database transactions.
        
        Usage:
            with self._get_connection() as conn:
                with self._transaction(conn):
                    # perform operations
                    conn.execute(...)
        
        Automatically commits on success, rolls back on error.
        
        Args:
            conn: Database connection
        """
        try:
            conn.execute("BEGIN TRANSACTION")
            yield conn
            conn.execute("COMMIT")
        except Exception as e:
            conn.execute("ROLLBACK")
            logger.error(f"Transaction rolled back due to error: {e}")
            raise

    def insert_transactions(
        self,
        transactions: List[Dict[str, Any]],
        source_file: Optional[str] = None
    ) -> int:
        """
        Insert multiple transactions into the ledger.

        Args:
            transactions: List of transaction dictionaries with keys:
                - date: Transaction date (YYYY-MM-DD)
                - description: Transaction description
                - amount: Signed amount in dollars (negative=debit, positive=credit)
                - account: (optional) Account name
            source_file: Name of the source PDF file

        Returns:
            Number of transactions successfully inserted (excludes duplicates)

        Note:
            Uses batch insert with transaction wrapping for atomicity.
            Duplicate transactions (same date, description, amount, source) are skipped.
        """
        if not transactions:
            return 0

        insert_sql = """
        INSERT OR IGNORE INTO transactions 
        (date, description, amount_cents, category, account, source_file, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """

        now = datetime.now().isoformat()
        rows = []

        for txn in transactions:
            # Convert amount from dollars to cents
            amount_dollars = txn.get("amount", 0.0)
            amount_cents = dollars_to_cents(amount_dollars)
            
            row = (
                txn.get("date", ""),
                txn.get("description", ""),
                amount_cents,
                txn.get("category", "Needs Review"),
                txn.get("account", "Unknown"),
                source_file,
                now
            )
            rows.append(row)

        inserted = 0
        with self._get_connection() as conn:
            with self._transaction(conn):
                cursor = conn.cursor()
                cursor.executemany(insert_sql, rows)
                inserted = cursor.rowcount

        logger.info(f"Inserted {inserted} transactions from {source_file}")
        return inserted

    def update_category(self, transaction_id: int, category: str) -> bool:
        """
        Update the category for a specific transaction.

        Args:
            transaction_id: Primary key of the transaction
            category: New category name

        Returns:
            True if update was successful
        """
        update_sql = """
        UPDATE transactions 
        SET category = ?, updated_at = ?
        WHERE id = ?
        """

        with self._get_connection() as conn:
            with self._transaction(conn):
                cursor = conn.cursor()
                cursor.execute(update_sql, (category, datetime.now().isoformat(), transaction_id))
                updated = cursor.rowcount > 0

        if updated:
            logger.debug(f"Updated transaction {transaction_id} category to {category}")

        return updated

    def update_categories_batch(
        self,
        updates: List[Tuple[int, str]]
    ) -> int:
        """
        Update categories for multiple transactions.

        Args:
            updates: List of (transaction_id, category) tuples

        Returns:
            Number of transactions updated
        """
        if not updates:
            return 0

        update_sql = """
        UPDATE transactions 
        SET category = ?, updated_at = ?
        WHERE id = ?
        """

        now = datetime.now().isoformat()

        with self._get_connection() as conn:
            with self._transaction(conn):
                cursor = conn.cursor()
                cursor.executemany(
                    update_sql,
                    [(category, now, txn_id) for txn_id, category in updates]
                )
                updated = cursor.rowcount

        logger.info(f"Batch updated {updated} transaction categories")
        return updated

    def get_uncategorized_transactions(
        self,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Get transactions that haven't been categorized yet.

        Args:
            limit: Maximum number of transactions to return

        Returns:
            List of transaction dictionaries with amount in dollars
        """
        query = """
        SELECT id, date, description, amount_cents, category, account, source_file, created_at
        FROM transactions
        WHERE category = 'Needs Review' OR category IS NULL
        ORDER BY date DESC
        """

        params: list = []
        if limit:
            query += " LIMIT ?"
            params.append(limit)

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()

        # Convert cents to dollars in result
        return [self._row_to_dict(row) for row in rows]

    def _row_to_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        """
        Convert a database row to a dictionary with amount in dollars.

        Args:
            row: SQLite Row object

        Returns:
            Dictionary with amount converted from cents to dollars
        """
        result = dict(row)
        # Convert amount_cents to amount (dollars)
        if 'amount_cents' in result:
            result['amount'] = cents_to_dollars(result.pop('amount_cents'))
        # Add type field for frontend compatibility
        result['type'] = 'income' if result.get('amount', 0) >= 0 else 'expense'
        return result

    def get_all_transactions(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        category: Optional[str] = None,
        source_file: Optional[str] = None,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Query transactions with optional filters.

        Args:
            start_date: Filter transactions on or after this date (YYYY-MM-DD)
            end_date: Filter transactions on or before this date (YYYY-MM-DD)
            category: Filter by category
            source_file: Filter by source file
            limit: Maximum number of transactions to return

        Returns:
            List of transaction dictionaries with amount in dollars
        """
        query = """
        SELECT id, date, description, amount_cents, category, account, source_file, created_at
        FROM transactions
        WHERE 1=1
        """

        params = []

        if start_date:
            query += " AND date >= ?"
            params.append(start_date)

        if end_date:
            query += " AND date <= ?"
            params.append(end_date)

        if category:
            query += " AND category = ?"
            params.append(category)

        if source_file:
            query += " AND source_file = ?"
            params.append(source_file)

        query += " ORDER BY date DESC"
        
        if limit:
            query += " LIMIT ?"
            params.append(limit)

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()

        return [self._row_to_dict(row) for row in rows]

    def get_transactions_by_id(self, ids: List[int]) -> List[Dict[str, Any]]:
        """
        Get specific transactions by their IDs.

        Args:
            ids: List of transaction IDs

        Returns:
            List of transaction dictionaries with amount in dollars
        """
        if not ids:
            return []

        placeholders = ",".join("?" * len(ids))
        query = f"""
        SELECT id, date, description, amount_cents, category, account, source_file, created_at
        FROM transactions
        WHERE id IN ({placeholders})
        """

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, ids)
            rows = cursor.fetchall()

        return [self._row_to_dict(row) for row in rows]

    def get_category_summary(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get summary of transactions grouped by category.

        Args:
            start_date: Filter transactions on or after this date
            end_date: Filter transactions on or before this date

        Returns:
            List of dictionaries with category, count, total_amount in dollars
        """
        query = """
        SELECT 
            category,
            COUNT(*) as count,
            SUM(amount_cents) as total_amount_cents,
            SUM(CASE WHEN amount_cents < 0 THEN ABS(amount_cents) ELSE 0 END) as total_debits_cents,
            SUM(CASE WHEN amount_cents > 0 THEN amount_cents ELSE 0 END) as total_credits_cents
        FROM transactions
        WHERE 1=1
        """

        params = []

        if start_date:
            query += " AND date >= ?"
            params.append(start_date)

        if end_date:
            query += " AND date <= ?"
            params.append(end_date)

        query += " GROUP BY category ORDER BY total_amount_cents ASC"

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()

        # Convert cents to dollars in results
        result = []
        for row in rows:
            row_dict = dict(row)
            row_dict['total_amount'] = cents_to_dollars(row_dict.pop('total_amount_cents', 0))
            row_dict['total_debits'] = cents_to_dollars(row_dict.pop('total_debits_cents', 0))
            row_dict['total_credits'] = cents_to_dollars(row_dict.pop('total_credits_cents', 0))
            result.append(row_dict)

        return result

    def get_monthly_summary(
        self,
        year: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Get monthly summary of income and expenses.

        Args:
            year: Filter by specific year (optional)

        Returns:
            List of dictionaries with month, income, expenses, net (all in dollars)
        """
        query = """
        SELECT 
            strftime('%Y-%m', date) as month,
            SUM(CASE WHEN amount_cents > 0 THEN amount_cents ELSE 0 END) as income_cents,
            SUM(CASE WHEN amount_cents < 0 THEN ABS(amount_cents) ELSE 0 END) as expenses_cents,
            SUM(amount_cents) as net_cents
        FROM transactions
        WHERE 1=1
        """

        params = []

        if year:
            query += " AND strftime('%Y', date) = ?"
            params.append(str(year))

        query += " GROUP BY month ORDER BY month"

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()

        # Convert cents to dollars in results
        result = []
        for row in rows:
            row_dict = dict(row)
            row_dict['income'] = cents_to_dollars(row_dict.pop('income_cents', 0))
            row_dict['expenses'] = cents_to_dollars(row_dict.pop('expenses_cents', 0))
            row_dict['net'] = cents_to_dollars(row_dict.pop('net_cents', 0))
            result.append(row_dict)

        return result

    def get_large_transactions(
        self,
        threshold: float,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get transactions above a specified amount threshold.

        Args:
            threshold: Minimum absolute amount in dollars
            start_date: Filter transactions on or after this date
            end_date: Filter transactions on or before this date

        Returns:
            List of large transaction dictionaries with amount in dollars
        """
        # Convert threshold to cents
        threshold_cents = dollars_to_cents(threshold)
        
        query = """
        SELECT id, date, description, amount_cents, category, account, source_file, created_at
        FROM transactions
        WHERE ABS(amount_cents) >= ?
        """

        params = [threshold_cents]

        if start_date:
            query += " AND date >= ?"
            params.append(start_date)

        if end_date:
            query += " AND date <= ?"
            params.append(end_date)

        query += " ORDER BY amount_cents ASC"

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()

        return [self._row_to_dict(row) for row in rows]

    def get_transaction_count(self) -> int:
        """
        Get total number of transactions in the ledger.

        Returns:
            Total count
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) as count FROM transactions")
            return cursor.fetchone()["count"]

    def get_date_range(self) -> Tuple[Optional[str], Optional[str]]:
        """
        Get the date range of transactions in the ledger.

        Returns:
            Tuple of (min_date, max_date) or (None, None) if empty
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT MIN(date) as min_date, MAX(date) as max_date FROM transactions"
            )
            row = cursor.fetchone()
            return row["min_date"], row["max_date"]

    def clear_all(self):
        """
        Delete all transactions from the ledger.

        Warning: This operation cannot be undone.
        """
        with self._get_connection() as conn:
            with self._transaction(conn):
                conn.execute("DELETE FROM transactions")
        logger.warning("All transactions cleared from ledger")

    def get_source_files(self) -> List[str]:
        """
        Get list of all source files in the ledger.

        Returns:
            List of unique source file names
        """
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT DISTINCT source_file FROM transactions WHERE source_file IS NOT NULL"
            )
            return [row["source_file"] for row in cursor.fetchall()]

    def get_merchant_categories(self) -> Dict[str, str]:
        """
        Get a mapping of normalized merchant names to their most common category.
        
        This is used for merchant caching to speed up categorization.
        
        Returns:
            Dictionary mapping merchant name to category
        """
        query = """
        SELECT 
            LOWER(description) as merchant,
            category,
            COUNT(*) as count
        FROM transactions
        WHERE category != 'Needs Review'
        GROUP BY LOWER(description), category
        """
        
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query)
            rows = cursor.fetchall()
        
        # For each merchant, find the most common category
        merchant_categories = {}
        for row in rows:
            merchant = row['merchant']
            category = row['category']
            count = row['count']
            
            if merchant not in merchant_categories or count > merchant_categories[merchant][1]:
                merchant_categories[merchant] = (category, count)
        
        return {k: v[0] for k, v in merchant_categories.items()}

    def __repr__(self) -> str:
        """String representation of the ledger."""
        count = self.get_transaction_count()
        return f"Ledger(path={self.db_path}, transactions={count})"
