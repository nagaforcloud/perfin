#!/usr/bin/env python3
"""
Database Migration Script for AI Accountant.

Migrates the ledger database from the old schema (REAL amounts) to the new
schema (INTEGER cents with UNIQUE constraint).

This script:
1. Creates a backup of the existing database
2. Creates a new table with the updated schema
3. Migrates all data, converting amounts to cents
4. Removes duplicates based on the UNIQUE constraint
5. Replaces the old database with the new one

Usage:
    python migrate_database.py [--backup-dir <path>]
"""

import sqlite3
import shutil
import sys
import logging
from pathlib import Path
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

CENTS_PER_DOLLAR = 100


def dollars_to_cents(amount: float) -> int:
    """Convert dollar amount to integer cents."""
    decimal_amount = Decimal(str(amount))
    return int((decimal_amount * CENTS_PER_DOLLAR).quantize(Decimal('1'), rounding=ROUND_HALF_UP))


def get_old_schema(db_path: Path) -> bool:
    """Check if database has the old schema (amount REAL instead of amount_cents INTEGER)."""
    if not db_path.exists():
        return False
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Get table info
    cursor.execute("PRAGMA table_info(transactions)")
    columns = {row[1]: row[2] for row in cursor.fetchall()}
    
    conn.close()
    
    # Check if old schema (has 'amount' as REAL)
    return 'amount' in columns and columns['amount'] == 'REAL'


def migrate_database(db_path: Path, backup_dir: Optional[Path] = None) -> bool:
    """
    Migrate database from old schema to new schema.
    
    Args:
        db_path: Path to the database file
        backup_dir: Directory for backup (default: same directory with .backup suffix)
    
    Returns:
        True if migration was successful, False if no migration needed
    """
    if not db_path.exists():
        logger.info("Database does not exist, no migration needed")
        return False
    
    if not get_old_schema(db_path):
        logger.info("Database already has new schema, no migration needed")
        return False
    
    logger.info("Starting database migration...")
    
    # Create backup
    if backup_dir is None:
        backup_dir = db_path.parent
    
    backup_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = backup_dir / f"ledger_backup_{timestamp}.db"
    
    logger.info(f"Creating backup at {backup_path}")
    shutil.copy2(db_path, backup_path)
    
    # Read all data from old database
    logger.info("Reading existing data...")
    old_conn = sqlite3.connect(str(db_path))
    old_conn.row_factory = sqlite3.Row
    old_cursor = old_conn.cursor()
    
    old_cursor.execute("""
        SELECT id, date, description, amount, category, account, source_file, created_at, updated_at
        FROM transactions
        ORDER BY id
    """)
    
    rows = old_cursor.fetchall()
    old_conn.close()
    
    logger.info(f"Found {len(rows)} transactions to migrate")
    
    # Create new database with new schema
    new_schema = """
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
    
    CREATE INDEX IF NOT EXISTS idx_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_category ON transactions(category);
    CREATE INDEX IF NOT EXISTS idx_amount_cents ON transactions(amount_cents);
    CREATE INDEX IF NOT EXISTS idx_description ON transactions(description);
    CREATE INDEX IF NOT EXISTS idx_source_file ON transactions(source_file);
    
    PRAGMA journal_mode=WAL;
    PRAGMA synchronous=NORMAL;
    PRAGMA temp_store=MEMORY;
    """
    
    # Create temporary new database
    temp_path = db_path.parent / "ledger_new.db"
    if temp_path.exists():
        temp_path.unlink()
    
    new_conn = sqlite3.connect(str(temp_path))
    new_cursor = new_conn.cursor()
    new_cursor.executescript(new_schema)
    
    # Insert data with converted amounts
    logger.info("Migrating data with amount conversion...")
    insert_sql = """
    INSERT OR IGNORE INTO transactions 
    (date, description, amount_cents, category, account, source_file, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """
    
    inserted = 0
    skipped = 0
    
    for row in rows:
        try:
            amount_cents = dollars_to_cents(row['amount'])
            
            new_cursor.execute(insert_sql, (
                row['date'],
                row['description'],
                amount_cents,
                row['category'] or 'Needs Review',
                row['account'] or 'Unknown',
                row['source_file'],
                row['created_at'],
                row['updated_at']
            ))
            inserted += 1
        except sqlite3.IntegrityError:
            # Duplicate based on UNIQUE constraint
            skipped += 1
            logger.debug(f"Skipped duplicate: {row['date']} - {row['description']}")
    
    new_conn.commit()
    new_conn.close()
    
    logger.info(f"Migration complete: {inserted} inserted, {skipped} duplicates skipped")
    
    # Replace old database with new one
    db_path.unlink()
    shutil.move(str(temp_path), str(db_path))
    
    logger.info(f"Database migrated successfully. Backup saved at: {backup_path}")
    
    return True


def main():
    """Main entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Migrate AI Accountant database to new schema')
    parser.add_argument('--backup-dir', type=Path, help='Directory for database backup')
    parser.add_argument('--db-path', type=Path, default=None, help='Path to database file')
    
    args = parser.parse_args()
    
    # Determine database path
    if args.db_path:
        db_path = args.db_path
    else:
        # Default location
        script_dir = Path(__file__).parent
        db_path = script_dir / "database" / "ledger.db"
    
    if not db_path.exists():
        print(f"Database not found at {db_path}")
        print("No migration needed - database will be created with new schema on first run.")
        return 0
    
    try:
        migrated = migrate_database(db_path, args.backup_dir)
        
        if migrated:
            print("\n" + "=" * 60)
            print("Migration completed successfully!")
            print("=" * 60)
            print(f"Database: {db_path}")
            print("The new schema uses INTEGER cents for precise currency storage")
            print("and includes a UNIQUE constraint to prevent duplicates.")
            print("=" * 60 + "\n")
            return 0
        else:
            print("No migration was needed.")
            return 0
            
    except Exception as e:
        logger.exception(f"Migration failed: {e}")
        print(f"\nMigration failed: {e}")
        print("Your original database has not been modified.")
        return 1


if __name__ == '__main__':
    sys.exit(main())
