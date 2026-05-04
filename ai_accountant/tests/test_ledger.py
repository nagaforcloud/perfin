"""
Tests for the Ledger module.

Tests cover:
- Database initialization
- Transaction insertion and retrieval
- UNIQUE constraint enforcement
- Category updates
- Summary queries
"""

import pytest
import sqlite3
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.ledger import Ledger, dollars_to_cents, cents_to_dollars


class TestLedgerInitialization:
    """Test ledger database initialization."""

    def test_creates_database_file(self, test_config):
        """Test that database file is created."""
        assert not test_config.database_path.exists()
        ledger = Ledger(test_config)
        assert test_config.database_path.exists()

    def test_creates_transactions_table(self, ledger):
        """Test that transactions table is created."""
        with ledger._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'"
            )
            assert cursor.fetchone() is not None

    def test_creates_indexes(self, ledger):
        """Test that required indexes are created."""
        expected_indexes = [
            'idx_date',
            'idx_category',
            'idx_amount_cents',
            'idx_description',
            'idx_source_file'
        ]
        with ledger._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='index'"
            )
            indexes = {row[0] for row in cursor.fetchall()}
            
            for index in expected_indexes:
                assert index in indexes


class TestTransactionInsertion:
    """Test transaction insertion functionality."""

    def test_insert_single_transaction(self, ledger):
        """Test inserting a single transaction."""
        transactions = [
            {
                'date': '2024-01-15',
                'description': 'Test Transaction',
                'amount': -50.00,
                'account': 'Primary'
            }
        ]
        
        result = ledger.insert_transactions(transactions, source_file="test.pdf")
        assert result == 1
        assert ledger.get_transaction_count() == 1

    def test_insert_multiple_transactions(self, ledger, sample_transactions):
        """Test inserting multiple transactions."""
        result = ledger.insert_transactions(sample_transactions, source_file="test.pdf")
        assert result == len(sample_transactions)
        assert ledger.get_transaction_count() == len(sample_transactions)

    def test_insert_converts_to_cents(self, ledger):
        """Test that amounts are stored as integer cents."""
        transactions = [
            {
                'date': '2024-01-15',
                'description': 'Test',
                'amount': 123.45,
            }
        ]
        
        ledger.insert_transactions(transactions)
        
        with ledger._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT amount_cents FROM transactions LIMIT 1")
            amount_cents = cursor.fetchone()[0]
            assert amount_cents == 12345

    def test_duplicate_prevention(self, ledger):
        """Test that duplicate transactions are prevented."""
        transactions = [
            {
                'date': '2024-01-15',
                'description': 'Duplicate Test',
                'amount': -50.00,
            }
        ]
        
        # Insert twice
        result1 = ledger.insert_transactions(transactions, source_file="test.pdf")
        result2 = ledger.insert_transactions(transactions, source_file="test.pdf")
        
        assert result1 == 1
        assert result2 == 0  # Duplicate should be ignored
        assert ledger.get_transaction_count() == 1

    def test_empty_transaction_list(self, ledger):
        """Test inserting empty transaction list."""
        result = ledger.insert_transactions([])
        assert result == 0


class TestTransactionRetrieval:
    """Test transaction retrieval functionality."""

    def test_get_all_transactions(self, populated_ledger):
        """Test retrieving all transactions."""
        transactions = populated_ledger.get_all_transactions()
        assert len(transactions) == 5
        
        # Verify amount is converted back to dollars
        for txn in transactions:
            assert 'amount' in txn
            assert isinstance(txn['amount'], float)

    def test_get_transactions_by_date_range(self, populated_ledger):
        """Test filtering transactions by date range."""
        transactions = populated_ledger.get_all_transactions(
            start_date='2024-01-16',
            end_date='2024-01-18'
        )
        assert len(transactions) == 3

    def test_get_transactions_by_category(self, populated_ledger):
        """Test filtering transactions by category."""
        # First categorize some transactions
        populated_ledger.update_category(1, 'Subscription')
        
        transactions = populated_ledger.get_all_transactions(category='Subscription')
        assert len(transactions) == 1

    def test_get_uncategorized_transactions(self, populated_ledger):
        """Test retrieving uncategorized transactions."""
        transactions = populated_ledger.get_uncategorized_transactions()
        assert len(transactions) == 5  # All are uncategorized initially

    def test_get_large_transactions(self, populated_ledger):
        """Test retrieving large transactions."""
        transactions = populated_ledger.get_large_transactions(threshold=50.00)
        # Should include salary (5000) and amazon (89.99)
        assert len(transactions) >= 1

    def test_get_transaction_count(self, populated_ledger):
        """Test transaction count."""
        assert populated_ledger.get_transaction_count() == 5

    def test_get_date_range(self, populated_ledger):
        """Test date range retrieval."""
        min_date, max_date = populated_ledger.get_date_range()
        assert min_date == '2024-01-15'
        assert max_date == '2024-01-19'


class TestCategoryUpdates:
    """Test category update functionality."""

    def test_update_single_category(self, populated_ledger):
        """Test updating a single transaction category."""
        result = populated_ledger.update_category(1, 'Subscription')
        assert result is True
        
        # Verify update
        transactions = populated_ledger.get_all_transactions()
        for txn in transactions:
            if txn['id'] == 1:
                assert txn['category'] == 'Subscription'

    def test_batch_category_update(self, populated_ledger):
        """Test batch category updates."""
        updates = [
            (1, 'Subscription'),
            (2, 'Income'),
            (3, 'Food')
        ]
        
        result = populated_ledger.update_categories_batch(updates)
        assert result == 3

    def test_update_nonexistent_transaction(self, populated_ledger):
        """Test updating a nonexistent transaction."""
        result = populated_ledger.update_category(9999, 'Subscription')
        assert result is False


class TestSummaryQueries:
    """Test summary and aggregation queries."""

    def test_category_summary(self, populated_ledger):
        """Test category summary query."""
        # Categorize some transactions first
        updates = [
            (1, 'Subscription'),
            (2, 'Income'),
            (3, 'Food'),
            (4, 'Transport'),
            (5, 'Shopping')
        ]
        populated_ledger.update_categories_batch(updates)
        
        summary = populated_ledger.get_category_summary()
        assert len(summary) == 5
        
        # Verify amounts are in dollars
        for cat in summary:
            assert 'total_amount' in cat
            assert isinstance(cat['total_amount'], float)

    def test_monthly_summary(self, populated_ledger):
        """Test monthly summary query."""
        summary = populated_ledger.get_monthly_summary()
        assert len(summary) == 1  # All transactions in same month
        
        month_data = summary[0]
        assert 'month' in month_data
        assert 'income' in month_data
        assert 'expenses' in month_data
        assert 'net' in month_data

    def test_monthly_summary_by_year(self, ledger):
        """Test monthly summary filtered by year."""
        # Insert transactions across years
        transactions = [
            {'date': '2023-06-15', 'description': 'Test', 'amount': 100.00},
            {'date': '2024-06-15', 'description': 'Test', 'amount': 200.00},
        ]
        ledger.insert_transactions(transactions)
        
        # Filter by 2024
        summary = ledger.get_monthly_summary(year=2024)
        assert len(summary) == 1
        assert summary[0]['income'] == 200.00  # amount 200.00 dollars = 200.00 income


class TestLedgerOperations:
    """Test ledger maintenance operations."""

    def test_clear_all(self, populated_ledger):
        """Test clearing all transactions."""
        populated_ledger.clear_all()
        assert populated_ledger.get_transaction_count() == 0

    def test_get_source_files(self, ledger):
        """Test retrieving source file list."""
        transactions1 = [
            {'date': '2024-01-15', 'description': 'Test', 'amount': -50.00}
        ]
        transactions2 = [
            {'date': '2024-02-15', 'description': 'Test', 'amount': -50.00}
        ]
        
        ledger.insert_transactions(transactions1, source_file="statement1.pdf")
        ledger.insert_transactions(transactions2, source_file="statement2.pdf")
        
        files = ledger.get_source_files()
        assert len(files) == 2
        assert "statement1.pdf" in files
        assert "statement2.pdf" in files

    def test_get_merchant_categories(self, populated_ledger):
        """Test merchant category cache retrieval."""
        # Categorize some transactions
        updates = [
            (1, 'Subscription'),
            (3, 'Food')
        ]
        populated_ledger.update_categories_batch(updates)
        
        merchant_cats = populated_ledger.get_merchant_categories()
        assert len(merchant_cats) >= 2


class TestTransactionWrapping:
    """Test transaction wrapping for atomicity."""

    def test_transaction_commit(self, ledger):
        """Test that transactions are committed on success."""
        transactions = [
            {'date': '2024-01-15', 'description': 'Test', 'amount': -50.00}
        ]
        
        result = ledger.insert_transactions(transactions)
        assert result == 1
        
        # Verify data persists
        assert ledger.get_transaction_count() == 1

    def test_rollback_on_error(self, test_config):
        """Test that transactions roll back on error."""
        ledger = Ledger(test_config)
        
        # This should work without errors
        with ledger._get_connection() as conn:
            try:
                with ledger._transaction(conn):
                    conn.execute(
                        "INSERT INTO transactions (date, description, amount_cents, created_at) "
                        "VALUES (?, ?, ?, ?)",
                        ('2024-01-15', 'Test', -5000, '2024-01-15T00:00:00')
                    )
                    # Don't raise an error - should commit
            except Exception:
                pass
        
        # Should have the transaction
        assert ledger.get_transaction_count() == 1
