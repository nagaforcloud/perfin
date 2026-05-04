#!/usr/bin/env python3
"""
AI Accountant - Main Entry Point

Run the financial processing pipeline from the command line.

Usage:
    python run_pipeline.py                    # Process all PDFs in data/pdf/
    python run_pipeline.py --pdf file.pdf     # Process specific PDF
    python run_pipeline.py --no-llm           # Skip LLM categorization
    python run_pipeline.py --no-report        # Skip report generation
"""

import argparse
import logging
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from core.config import Config
from core.pipeline import AIPipeline, run_pipeline
from core.ledger import Ledger

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='AI Accountant - Automated Financial Processing Pipeline',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s                              Process all PDFs in data/pdf/
  %(prog)s --pdf statement.pdf          Process specific PDF file
  %(prog)s --pdf *.pdf                  Process multiple PDFs
  %(prog)s --no-llm                     Skip LLM categorization (faster)
  %(prog)s --no-report                  Skip Excel report generation
  %(prog)s --summary                    Show ledger summary only
        """
    )
    
    parser.add_argument(
        '--pdf', '-p',
        nargs='+',
        help='PDF file(s) to process. If not specified, processes all PDFs in data/pdf/'
    )
    
    parser.add_argument(
        '--no-llm',
        action='store_true',
        help='Skip LLM-based categorization (uses only rule-based)'
    )
    
    parser.add_argument(
        '--no-report',
        action='store_true',
        help='Skip Excel report generation'
    )
    
    parser.add_argument(
        '--summary',
        action='store_true',
        help='Show ledger summary and exit'
    )
    
    parser.add_argument(
        '--clear',
        action='store_true',
        help='Clear all transactions from ledger (use with caution)'
    )
    
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose (debug) logging'
    )
    
    args = parser.parse_args()
    
    # Set logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Initialize configuration
    config = Config()
    
    # Handle summary command
    if args.summary:
        ledger = Ledger(config)
        summary = ledger.get_transaction_count()
        uncategorized = len(ledger.get_uncategorized_transactions())
        date_range = ledger.get_date_range()
        
        print("\n" + "=" * 50)
        print("Ledger Summary")
        print("=" * 50)
        print(f"Total Transactions: {summary}")
        print(f"Uncategorized: {uncategorized}")
        print(f"Categorized: {summary - uncategorized}")
        print(f"Date Range: {date_range[0] or 'N/A'} to {date_range[1] or 'N/A'}")
        print(f"Source Files: {len(ledger.get_source_files())}")
        print("=" * 50 + "\n")
        return 0
    
    # Handle clear command
    if args.clear:
        confirm = input("WARNING: This will delete ALL transactions. Type 'YES' to confirm: ")
        if confirm == 'YES':
            ledger = Ledger(config)
            ledger.clear_all()
            print("All transactions cleared.")
        else:
            print("Operation cancelled.")
        return 0
    
    # Run pipeline
    logger.info("Starting AI Accountant Pipeline")
    
    try:
        stats = run_pipeline(
            pdf_paths=args.pdf,
            generate_report=not args.no_report,
            use_llm=not args.no_llm,
            config=config
        )
        
        # Print final summary
        print("\n" + "=" * 50)
        print("Pipeline Complete")
        print("=" * 50)
        print(f"Duration: {stats.duration_seconds:.2f} seconds")
        print(f"PDFs Processed: {stats.pdfs_processed}")
        print(f"Transactions Extracted: {stats.transactions_extracted}")
        print(f"Transactions Categorized (Rules): {stats.transactions_categorized_rules}")
        print(f"Transactions Categorized (LLM): {stats.transactions_categorized_llm}")
        print(f"Recurring Payments Detected: {stats.recurring_payments_detected}")
        print(f"Anomalies Detected: {stats.anomalies_detected}")
        
        if stats.report_generated:
            print(f"Report Generated: {stats.report_generated}")
        
        if stats.errors:
            print(f"\nErrors: {len(stats.errors)}")
            for error in stats.errors:
                print(f"  - {error}")
        
        print("=" * 50 + "\n")
        
        return 0 if stats.success else 1
        
    except KeyboardInterrupt:
        logger.info("Pipeline interrupted by user")
        return 130
    except Exception as e:
        logger.exception(f"Pipeline failed: {e}")
        return 1


if __name__ == '__main__':
    sys.exit(main())
