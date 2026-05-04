"""
Pytest configuration and shared fixtures for AI Accountant tests.
"""

import pytest
import tempfile
import shutil
from pathlib import Path
from datetime import datetime, timedelta
import sys

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.config import Config
from core.ledger import Ledger, dollars_to_cents, cents_to_dollars


@pytest.fixture
def temp_dir():
    """Create a temporary directory for test files."""
    temp = tempfile.mkdtemp()
    yield Path(temp)
    shutil.rmtree(temp)


@pytest.fixture
def test_config(temp_dir):
    """Create a test configuration with isolated directories."""
    # Create a custom config with test directories
    config = Config()
    config._test_base_dir = temp_dir
    
    # Override paths to use temp directory
    config.data_dir = temp_dir / "data"
    config.pdf_dir = temp_dir / "data" / "pdf"
    config.processed_dir = temp_dir / "data" / "processed"
    config.reports_dir = temp_dir / "data" / "reports"
    config.database_dir = temp_dir / "database"
    config.rules_dir = temp_dir / "rules"
    
    # Create directories
    for directory in [
        config.data_dir,
        config.pdf_dir,
        config.processed_dir,
        config.reports_dir,
        config.database_dir,
        config.rules_dir
    ]:
        directory.mkdir(parents=True, exist_ok=True)
    
    # Set database path
    config.database_path = config.database_dir / "test_ledger.db"
    config.merchant_rules_path = config.rules_dir / "merchant_rules.json"
    
    return config


@pytest.fixture
def ledger(test_config):
    """Create a test ledger with empty database."""
    ldb = Ledger(test_config)
    yield ldb
    # Cleanup is handled by temp_dir fixture


@pytest.fixture
def sample_transactions():
    """Sample transaction data for testing."""
    return [
        {
            'date': '2024-01-15',
            'description': 'Netflix Subscription',
            'amount': -15.99,
            'account': 'Primary',
            'category': 'Needs Review'
        },
        {
            'date': '2024-01-16',
            'description': 'Salary Deposit',
            'amount': 5000.00,
            'account': 'Primary',
            'category': 'Needs Review'
        },
        {
            'date': '2024-01-17',
            'description': 'Starbucks Coffee',
            'amount': -5.50,
            'account': 'Primary',
            'category': 'Needs Review'
        },
        {
            'date': '2024-01-18',
            'description': 'Uber Ride',
            'amount': -25.00,
            'account': 'Primary',
            'category': 'Needs Review'
        },
        {
            'date': '2024-01-19',
            'description': 'Amazon Purchase',
            'amount': -89.99,
            'account': 'Primary',
            'category': 'Needs Review'
        },
    ]


@pytest.fixture
def populated_ledger(ledger, sample_transactions):
    """Create a ledger populated with sample transactions."""
    ledger.insert_transactions(sample_transactions, source_file="test.pdf")
    return ledger


@pytest.fixture
def sample_rules():
    """Sample categorization rules for testing."""
    return [
        {"keywords": ["netflix"], "category": "Subscription", "priority": 10},
        {"keywords": ["starbucks", "coffee"], "category": "Food", "priority": 9},
        {"keywords": ["uber", "lyft"], "category": "Transport", "priority": 9},
        {"keywords": ["amazon"], "category": "Shopping", "priority": 9},
        {"keywords": ["salary"], "category": "Income", "priority": 10},
    ]


@pytest.fixture
def mock_llm_response():
    """Mock LLM response for testing."""
    return {
        "choices": [
            {
                "message": {
                    "content": '[{"index": 0, "category": "Subscription", "confidence": 0.95, "reason": "Streaming service"}]'
                }
            }
        ],
        "usage": {"prompt_tokens": 100, "completion_tokens": 50}
    }


# Currency conversion tests
def test_dollars_to_cents():
    """Test dollar to cents conversion."""
    assert dollars_to_cents(123.45) == 12345
    assert dollars_to_cents(-123.45) == -12345
    assert dollars_to_cents(0.01) == 1
    assert dollars_to_cents(1000.00) == 100000
    assert dollars_to_cents(0) == 0


def test_cents_to_dollars():
    """Test cents to dollars conversion."""
    assert cents_to_dollars(12345) == 123.45
    assert cents_to_dollars(-12345) == -123.45
    assert cents_to_dollars(1) == 0.01
    assert cents_to_dollars(100000) == 1000.0
    assert cents_to_dollars(0) == 0.0


def test_currency_conversion_roundtrip():
    """Test that conversion is reversible."""
    test_values = [123.45, -123.45, 0.01, 1000.00, 0, 99.99, 50.50]
    for value in test_values:
        assert cents_to_dollars(dollars_to_cents(value)) == value
