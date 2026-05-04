# Database Migration Notes

## Overview

Version 2.0 of AI Accountant introduces a new database schema with important changes for data integrity and precision.

## Schema Changes

### 1. Currency Storage: REAL → INTEGER (Cents)

**Before:**
```sql
amount REAL NOT NULL  -- e.g., 123.45
```

**After:**
```sql
amount_cents INTEGER NOT NULL  -- e.g., 12345
```

**Why:**
- Eliminates floating-point precision errors
- Ensures exact currency calculations
- Prevents rounding issues in financial reports

### 2. UNIQUE Constraint Added

**New Constraint:**
```sql
UNIQUE(date, description, amount_cents, source_file)
```

**Why:**
- Prevents duplicate transaction imports
- Ensures idempotent processing
- Protects against accidental re-imports

### 3. Performance Optimizations

**New PRAGMAs:**
```sql
PRAGMA journal_mode=WAL;      -- Write-Ahead Logging
PRAGMA synchronous=NORMAL;     -- Balanced durability/speed
PRAGMA temp_store=MEMORY;      -- Faster temp operations
PRAGMA cache_size=10000;       -- Larger cache
```

**Why:**
- WAL mode allows concurrent reads during writes
- NORMAL synchronous is safe for local databases
- Memory temp store speeds up complex queries

## Migration Process

### Automatic Migration

Run the migration script:

```bash
python migrate_database.py
```

The script will:
1. Create a timestamped backup of your database
2. Create a new table with the updated schema
3. Migrate all data, converting amounts to cents
4. Skip duplicates based on the UNIQUE constraint
5. Replace the old database with the new one

### Manual Migration

If you prefer to migrate manually:

```sql
-- 1. Backup existing data
CREATE TABLE transactions_backup AS SELECT * FROM transactions;

-- 2. Create new table
CREATE TABLE transactions_new (
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

-- 3. Migrate data (convert amounts to cents)
INSERT INTO transactions_new 
SELECT 
    id, date, description,
    CAST(ROUND(amount * 100) AS INTEGER) as amount_cents,
    category, account, source_file,
    created_at, updated_at
FROM transactions;

-- 4. Drop old table and rename new
DROP TABLE transactions;
ALTER TABLE transactions_new RENAME TO transactions;

-- 5. Create indexes
CREATE INDEX idx_date ON transactions(date);
CREATE INDEX idx_category ON transactions(category);
CREATE INDEX idx_amount_cents ON transactions(amount_cents);
CREATE INDEX idx_description ON transactions(description);
CREATE INDEX idx_source_file ON transactions(source_file);

-- 6. Enable WAL mode
PRAGMA journal_mode=WAL;
```

## Code Changes Required

### If You Have Custom Code

**Reading amounts:**
```python
# Before
amount = transaction['amount']  # Already in dollars

# After
from core.ledger import cents_to_dollars
amount = cents_to_dollars(transaction['amount_cents'])
# Or use ledger methods which handle conversion automatically
transactions = ledger.get_all_transactions()  # Returns amount in dollars
```

**Inserting transactions:**
```python
# Before
ledger.insert_transactions([{'amount': 123.45, ...}])

# After (same - conversion is automatic)
ledger.insert_transactions([{'amount': 123.45, ...}])
# The ledger automatically converts to cents
```

## Rollback Procedure

If you need to rollback to the old schema:

1. Locate the backup file created by migration:
   ```
   database/ledger_backup_YYYYMMDD_HHMMSS.db
   ```

2. Stop the application

3. Replace the current database:
   ```bash
   mv database/ledger.db database/ledger.db.new
   mv database/ledger_backup_*.db database/ledger.db
   ```

4. Restart the application

## Verification

After migration, verify the data:

```python
from core.ledger import Ledger, Config

ledger = Ledger(Config())

# Check transaction count
print(f"Transactions: {ledger.get_transaction_count()}")

# Check a sample transaction
txns = ledger.get_all_transactions(limit=1)
print(f"Sample amount: ${txns[0]['amount']:.2f}")

# Verify no duplicates
all_txns = ledger.get_all_transactions()
unique_check = set()
duplicates = 0
for t in all_txns:
    key = (t['date'], t['description'], t['amount'], t['source_file'])
    if key in unique_check:
        duplicates += 1
        print(f"Duplicate found: {key}")
    unique_check.add(key)

print(f"Duplicates: {duplicates}")
```

## Performance Impact

After migration, you should see:
- **Faster writes**: WAL mode allows concurrent operations
- **No floating-point errors**: Exact cent calculations
- **No duplicate imports**: UNIQUE constraint enforcement

## Support

If you encounter issues during migration:
1. Check the backup file exists
2. Verify the error message
3. Your original data is preserved in the backup
4. Open an issue with the error details
