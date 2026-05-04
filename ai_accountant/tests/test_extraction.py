"""
Tests for PDF extraction and normalization.
"""

import pytest
from pathlib import Path
from datetime import datetime
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.extract_pdf import PDFTransactionExtractor
from scripts.normalize_transactions import TransactionNormalizer


class TestDateParsing:
    """Test date parsing functionality."""

    def test_parses_iso_format(self):
        """Test parsing ISO date format."""
        extractor = PDFTransactionExtractor()
        
        assert extractor._parse_date('2024-01-15') == '2024-01-15'
        assert extractor._parse_date('2024-12-31') == '2024-12-31'

    def test_parses_slash_formats(self):
        """Test parsing slash-separated dates."""
        extractor = PDFTransactionExtractor()
        
        result = extractor._parse_date('15/01/2024')
        assert result == '2024-01-15'
        
        result = extractor._parse_date('01/15/2024')
        assert result == '2024-01-15'

    def test_parses_dash_formats(self):
        """Test parsing dash-separated dates."""
        extractor = PDFTransactionExtractor()
        
        result = extractor._parse_date('15-01-2024')
        assert result in ['2024-01-15', '2024-01-15']

    def test_parses_month_name_formats(self):
        """Test parsing dates with month names."""
        extractor = PDFTransactionExtractor()
        
        result = extractor._parse_date('15 Jan 2024')
        assert result == '2024-01-15'
        
        result = extractor._parse_date('15 January 2024')
        assert result == '2024-01-15'

    def test_returns_none_for_invalid_date(self):
        """Test that invalid dates return None."""
        extractor = PDFTransactionExtractor()
        
        assert extractor._parse_date('not a date') is None
        assert extractor._parse_date('') is None
        assert extractor._parse_date(None) is None


class TestAmountParsing:
    """Test amount parsing functionality."""

    def test_parses_plain_amount(self):
        """Test parsing plain amounts."""
        extractor = PDFTransactionExtractor()
        
        assert extractor._parse_amount('100.50') == 100.50
        assert extractor._parse_amount('50') == 50.0

    def test_parses_amount_with_currency(self):
        """Test parsing amounts with currency symbols."""
        extractor = PDFTransactionExtractor()
        
        assert extractor._parse_amount('$100.50') == 100.50
        assert extractor._parse_amount('₹100.50') == 100.50
        assert extractor._parse_amount('€100.50') == 100.50
        assert extractor._parse_amount('£100.50') == 100.50

    def test_parses_amount_with_commas(self):
        """Test parsing amounts with thousand separators."""
        extractor = PDFTransactionExtractor()
        
        assert extractor._parse_amount('1,000.50') == 1000.50
        assert extractor._parse_amount('$1,234,567.89') == 1234567.89

    def test_parses_negative_parentheses(self):
        """Test parsing negative amounts in parentheses."""
        extractor = PDFTransactionExtractor()
        
        assert extractor._parse_amount('(100.50)') == -100.50

    def test_returns_none_for_invalid(self):
        """Test that invalid amounts return None."""
        extractor = PDFTransactionExtractor()
        
        assert extractor._parse_amount('') is None
        assert extractor._parse_amount('abc') is None
        assert extractor._parse_amount(None) is None


class TestDescriptionCleaning:
    """Test description cleaning functionality."""

    def test_removes_extra_whitespace(self):
        """Test removal of extra whitespace."""
        extractor = PDFTransactionExtractor()
        
        result = extractor._clean_description('  Starbucks   Coffee  ')
        assert result == 'Starbucks Coffee'

    def test_removes_artifacts(self):
        """Test removal of common artifacts."""
        extractor = PDFTransactionExtractor()
        
        result = extractor._clean_description('Test * Payment | Charge')
        assert '*' not in result
        assert '|' not in result

    def test_truncates_long_descriptions(self):
        """Test truncation of long descriptions."""
        extractor = PDFTransactionExtractor()
        
        long_desc = 'A' * 300
        result = extractor._clean_description(long_desc)
        
        assert len(result) <= 200

    def test_handles_empty_description(self):
        """Test handling of empty descriptions."""
        extractor = PDFTransactionExtractor()
        
        assert extractor._clean_description('') == ''
        assert extractor._clean_description(None) == ''


class TestTransactionNormalizer:
    """Test transaction normalization."""

    def test_calculates_signed_amount_debit(self):
        """Test amount calculation for debits."""
        normalizer = TransactionNormalizer()
        
        amount = normalizer._calculate_amount(debit=50.0, credit=None)
        assert amount == -50.0

    def test_calculates_signed_amount_credit(self):
        """Test amount calculation for credits."""
        normalizer = TransactionNormalizer()
        
        amount = normalizer._calculate_amount(debit=None, credit=500.0)
        assert amount == 500.0

    def test_handles_both_debit_credit(self):
        """Test handling when both debit and credit present."""
        normalizer = TransactionNormalizer()
        
        # Should prefer credit
        amount = normalizer._calculate_amount(debit=50.0, credit=500.0)
        assert amount == 500.0

    def test_handles_no_amount(self):
        """Test handling when no amount information."""
        normalizer = TransactionNormalizer()
        
        amount = normalizer._calculate_amount(debit=None, credit=None)
        assert amount == 0.0

    def test_normalizes_single_transaction(self):
        """Test normalizing a single transaction."""
        normalizer = TransactionNormalizer()
        
        raw_txn = {
            'date': '2024-01-15',
            'description': '  Starbucks Coffee  ',
            'debit': 5.50,
            'credit': None,
            'page': 1
        }
        
        normalized = normalizer.normalize_single(raw_txn, source_file='test.pdf')
        
        assert normalized is not None
        assert normalized['date'] == '2024-01-15'
        assert normalized['description'] == 'Starbucks Coffee'
        assert normalized['amount'] == -5.50
        assert normalized['source_file'] == 'test.pdf'

    def test_rejects_missing_date(self):
        """Test rejection of transactions without date."""
        normalizer = TransactionNormalizer()
        
        raw_txn = {
            'description': 'Test',
            'debit': 50.0
        }
        
        result = normalizer.normalize_single(raw_txn)
        assert result is None

    def test_rejects_missing_description(self):
        """Test rejection of transactions without description."""
        normalizer = TransactionNormalizer()
        
        raw_txn = {
            'date': '2024-01-15',
            'debit': 50.0
        }
        
        result = normalizer.normalize_single(raw_txn)
        assert result is None

    def test_removes_duplicates(self):
        """Test duplicate removal in batch normalization."""
        normalizer = TransactionNormalizer()
        
        transactions = [
            {'date': '2024-01-15', 'description': 'Test', 'debit': 50.0},
            {'date': '2024-01-15', 'description': 'Test', 'debit': 50.0},  # Duplicate
        ]
        
        normalized = normalizer.normalize_batch(transactions)
        
        assert len(normalized) == 1

    def test_generates_signature(self):
        """Test signature generation for duplicate detection."""
        normalizer = TransactionNormalizer()
        
        txn = {
            'date': '2024-01-15',
            'amount': -50.0,
            'description': 'Test Transaction Description'
        }
        
        sig1 = normalizer._get_signature(txn)
        sig2 = normalizer._get_signature(txn)
        
        assert sig1 == sig2
        
        # Different transaction should have different signature
        txn2 = {
            'date': '2024-01-16',  # Different date
            'amount': -50.0,
            'description': 'Test Transaction Description'
        }
        sig3 = normalizer._get_signature(txn2)
        
        assert sig1 != sig3


class TestColumnIdentification:
    """Test column identification in tables."""

    def test_identifies_date_column(self):
        """Test identification of date column."""
        extractor = PDFTransactionExtractor()
        
        header = ['Date', 'Description', 'Debit', 'Credit', 'Balance']
        indices = extractor._identify_columns(header)
        
        assert 'date' in indices

    def test_identifies_description_column(self):
        """Test identification of description column."""
        extractor = PDFTransactionExtractor()
        
        header = ['Transaction Date', 'Particulars', 'Withdrawal', 'Deposit']
        indices = extractor._identify_columns(header)
        
        assert 'description' in indices

    def test_identifies_debit_credit_columns(self):
        """Test identification of debit/credit columns."""
        extractor = PDFTransactionExtractor()
        
        header = ['Date', 'Description', 'Amount (Dr)', 'Amount (Cr)']
        indices = extractor._identify_columns(header)
        
        assert 'debit' in indices
        assert 'credit' in indices

    def test_handles_lowercase_headers(self):
        """Test handling of lowercase headers."""
        extractor = PDFTransactionExtractor()
        
        header = ['date', 'description', 'debit', 'credit']
        indices = extractor._identify_columns(header)
        
        assert 'date' in indices
        assert 'description' in indices
