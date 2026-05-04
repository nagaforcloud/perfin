# AI Accountant

A fully local AI-powered financial processing system that automatically extracts, categorizes, and analyzes bank statement PDFs to produce comprehensive financial reports.

## Features

- **PDF Transaction Extraction**: Automatically extracts transactions from bank statement PDFs using pdfplumber
- **Intelligent Categorization**: Two-tier categorization system using rules and local LLM
- **Recurring Payment Detection**: Identifies subscriptions and recurring expenses with 15% amount tolerance
- **Anomaly Detection**: Flags unusual transactions for review
- **Financial Analytics**: Comprehensive spending analysis and health scoring
- **Excel Reports**: Professional multi-sheet financial reports
- **100% Local**: Runs entirely on your machine using llama.cpp
- **Production Hardened**: Prompt injection protection, secure file handling, transaction wrapping

## System Requirements

- **Hardware**: MacBook Air M1 or equivalent (16GB RAM recommended)
- **Python**: 3.9 or higher
- **LLM Server**: llama.cpp server running locally

## Performance

**Realistic Performance Expectations:**

| Configuration | 100 Transactions | 1000 Transactions |
|--------------|-----------------|-------------------|
| Without LLM (rules only) | ~2 seconds | ~15 seconds |
| With LLM categorization | ~15-20 seconds | ~45-60 seconds |

**Notes:**
- LLM performance depends on model size and server configuration
- Rule-based categorization handles ~70-80% of common transactions
- Merchant caching significantly speeds up re-processing
- PDF extraction is the fastest component (~100 txns/second)

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Bank PDFs      │────▶│  PDF Extractor   │────▶│  Normalizer     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Excel Report   │◀────│  Analytics       │◀────│  Ledger (SQLite)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                        │
                    ┌───────────────────────────────────┤
                    │                                   │
                    ▼                                   ▼
          ┌──────────────────┐               ┌──────────────────┐
          │  Rule Engine     │               │  LLM Categorizer │
          │  (Fast)          │◀─────────────▶│  (w/ Cache)      │
          └──────────────────┘               └──────────────────┘
```

## Installation

### 1. Clone and Setup

```bash
cd ai_accountant

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On macOS/Linux

# Install dependencies
pip install -r requirements.txt
```

### 2. Setup llama.cpp Server

Download and configure llama.cpp:

```bash
# Clone llama.cpp
git clone https://github.com/ggerganov/llama.cpp.git
cd llama.cpp

# Build for Mac M1
make -j

# Download a model (e.g., Llama-2-7B or Mistral-7B)
# Place the model in llama.cpp/models/

# Start the server
./server -m models/your-model.gguf -c 4096 --port 8080
```

Recommended models for M1:
- **Mistral-7B-Instruct**: Good balance of speed and accuracy
- **Llama-2-7B-Chat**: Well-tested, reliable
- **Phi-2**: Smaller, faster, good for classification

### 3. Database Migration (if upgrading)

If you have an existing database from a previous version:

```bash
python migrate_database.py
```

This migrates your database to the new schema with:
- INTEGER cents storage (no floating point errors)
- UNIQUE constraint (prevents duplicates)
- WAL mode (better performance)

### 4. Run Tests (Optional)

```bash
pip install pytest pytest-cov pytest-mock
pytest --cov=ai_accountant
```

## Usage

### Basic Usage

```bash
# Place your bank statement PDFs in data/pdf/

# Run the full pipeline
python run_pipeline.py

# View results in data/reports/
```

### Command Line Options

```bash
# Process specific PDF files
python run_pipeline.py --pdf statement_jan.pdf statement_feb.pdf

# Skip LLM categorization (faster, less accurate)
python run_pipeline.py --no-llm

# Skip report generation
python run_pipeline.py --no-report

# View ledger summary
python run_pipeline.py --summary

# Clear all data (use with caution)
python run_pipeline.py --clear

# Verbose output
python run_pipeline.py --verbose
```

### Programmatic Usage

```python
from core.pipeline import AIPipeline
from core.config import Config

# Initialize pipeline
config = Config()
pipeline = AIPipeline(config=config, use_llm=True)

# Process specific PDFs
results = pipeline.process_single_pdf('data/pdf/statement.pdf')

# Get ledger summary
summary = pipeline.get_ledger_summary()
print(f"Total transactions: {summary['total_transactions']}")

# Clean up
pipeline.close()
```

### Web UI

```bash
# Install streamlit
pip install streamlit

# Run the web interface
streamlit run ui.py
```

Then open http://localhost:8501 in your browser.

## Project Structure

```
ai_accountant/
├── core/
│   ├── __init__.py
│   ├── config.py          # Configuration management
│   ├── ledger.py          # SQLite database (INTEGER cents, WAL mode)
│   ├── llm_client.py      # LLM API client (prompt injection protection)
│   └── pipeline.py        # Main pipeline orchestrator
├── scripts/
│   ├── __init__.py
│   ├── extract_pdf.py     # PDF transaction extraction
│   ├── normalize_transactions.py  # Data normalization
│   ├── categorize_rules.py        # Rule-based categorization
│   ├── categorize_llm.py          # LLM categorization (with caching)
│   ├── detect_recurring.py        # Recurring payment detection
│   ├── detect_anomalies.py        # Anomaly detection
│   ├── financial_summary.py       # Financial analytics
│   └── export_excel.py            # Excel report generation
├── rules/
│   └── merchant_rules.json        # Merchant categorization rules
├── tests/
│   ├── __init__.py
│   ├── conftest.py        # Test fixtures
│   ├── test_ledger.py     # Database tests
│   ├── test_llm_client.py # LLM client tests
│   ├── test_categorization.py
│   ├── test_detection.py
│   ├── test_extraction.py
│   └── test_pipeline.py
├── data/
│   ├── pdf/              # Input PDF files
│   ├── processed/        # Processed data
│   └── reports/          # Generated reports
├── database/
│   └── ledger.db         # SQLite database
├── migrate_database.py   # Database migration script
├── requirements.txt
├── pytest.ini            # Test configuration
├── run_pipeline.py       # Main entry point
├── ui.py                 # Streamlit web UI
└── README.md
```

## Output

### Excel Report Sheets

1. **Summary**: Key metrics, financial health score, top categories
2. **All Transactions**: Complete transaction list with categories
3. **Category Summary**: Breakdown by category with totals
4. **Monthly Summary**: Month-by-month income vs expenses
5. **Recurring Payments**: Detected subscriptions and recurring charges
6. **Large Transactions**: Transactions above threshold
7. **Anomalies**: Flagged transactions requiring review
8. **Financial Health**: Health score and recommendations

### Categories

The system uses these categories:
- Income, Food, Groceries, Transport, Utilities
- Shopping, Rent, Insurance, Subscription
- Investment, Transfer, Medical, Entertainment
- Travel, Education, Professional Services
- Home Maintenance, Personal Care, Gifts & Donations
- Other, Needs Review

## Security Features

### Prompt Injection Protection
Transaction descriptions are sanitized before being sent to the LLM:
- Removes "ignore previous instructions" patterns
- Removes system/assistant prompt patterns
- Truncates to safe length (100 chars)
- Escapes special characters

### Secure File Handling
- Maximum file size: 10MB per PDF
- Path traversal protection
- PDF MIME type validation
- PDF header validation

### Database Security
- Parameterized SQL queries (SQL injection safe)
- Transaction wrapping for atomicity
- UNIQUE constraint prevents duplicates

## Customization

### Adding Custom Rules

Edit `rules/merchant_rules.json`:

```json
{
  "keywords": ["your-merchant", "another-keyword"],
  "category": "Your Category",
  "priority": 9,
  "exact_match": false
}
```

Priority levels:
- 10: Highest (checked first)
- 5-9: Medium
- 1-4: Low

### Configuration

Edit `core/config.py` to customize:
- LLM endpoint and batch size
- Category definitions
- Anomaly thresholds
- Recurring payment tolerance

## Troubleshooting

### LLM Connection Errors

```
Error: Connection refused to http://localhost:8080
```

Ensure llama.cpp server is running:
```bash
cd llama.cpp
./server -m models/your-model.gguf -c 4096 --port 8080
```

### PDF Extraction Issues

If transactions aren't being extracted:
1. Check PDF is not password-protected
2. Verify PDF contains selectable text (not scanned images)
3. Try `--verbose` flag for detailed logs

### Database Migration

If you see schema errors after updating:
```bash
python migrate_database.py
```

### Running Tests

```bash
# Install test dependencies
pip install pytest pytest-cov pytest-mock

# Run all tests
pytest

# Run with coverage
pytest --cov=ai_accountant --cov-report=html

# Run specific test file
pytest tests/test_ledger.py -v
```

## Performance Tips

1. **Use rule-based categorization** when possible - it's 10x faster than LLM
2. **Enable merchant caching** - already-seen merchants are categorized instantly
3. **Process in batches** - group monthly statements together
4. **Use smaller LLM models** - Phi-2 is faster than Llama-2-7B

## Security & Privacy

- All data stays local on your machine
- No cloud APIs or external services
- SQLite database stored in `database/ledger.db`
- PDFs remain in `data/pdf/`
- Transaction descriptions sanitized before LLM processing

## License

MIT License - See LICENSE file for details.

## Contributing

Contributions welcome! Please ensure:
- Code follows existing style
- Type hints are included
- Docstrings document public APIs
- Tests pass: `pytest`
- Coverage remains above 80%

## Changelog

### Version 2.0 (Production Hardened)

**Breaking Changes:**
- Database schema changed: amounts now stored as INTEGER cents
- Added UNIQUE constraint on transactions

**New Features:**
- Prompt injection protection
- Secure file upload handling
- Merchant caching for faster re-categorization
- Transaction wrapping for atomicity
- SQLite WAL mode for performance

**Improvements:**
- Better recurring payment detection (15% tolerance)
- Improved date flexibility (±5 days)
- Comprehensive test suite (80%+ coverage)
- Accurate performance documentation
