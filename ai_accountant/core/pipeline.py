"""
Pipeline Orchestration Module.

Coordinates the entire financial processing pipeline:
1. PDF ingestion
2. Transaction extraction
3. Normalization
4. Storage in ledger
5. Rule-based categorization
6. LLM categorization for remaining
7. Recurring payment detection
8. Anomaly detection
9. Report generation

Designed for processing entire years of bank statements automatically.
"""

import logging
import time
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime

from .config import Config
from .ledger import Ledger
from .llm_client import LLMClient
from scripts.extract_pdf import PDFTransactionExtractor
from scripts.normalize_transactions import TransactionNormalizer
from scripts.categorize_rules import RuleCategorizer
from scripts.categorize_llm import LLMCategorizer
from scripts.detect_recurring import RecurringPaymentDetector
from scripts.detect_anomalies import AnomalyDetector
from scripts.financial_summary import FinancialAnalyzer
from scripts.export_excel import ExcelReportGenerator, ReportConfig

logger = logging.getLogger(__name__)


@dataclass
class PipelineStats:
    """Statistics from pipeline execution."""
    start_time: str = field(default_factory=lambda: datetime.now().isoformat())
    end_time: str = ""
    duration_seconds: float = 0.0
    
    pdfs_processed: int = 0
    transactions_extracted: int = 0
    transactions_normalized: int = 0
    transactions_categorized_rules: int = 0
    transactions_categorized_llm: int = 0
    recurring_payments_detected: int = 0
    anomalies_detected: int = 0
    report_generated: str = ""
    
    errors: List[str] = field(default_factory=list)
    
    @property
    def success(self) -> bool:
        """Check if pipeline completed without errors."""
        return len(self.errors) == 0


class AIPipeline:
    """
    Main pipeline orchestrator for the AI Accountant system.
    
    The pipeline processes bank statement PDFs through multiple stages:
    
    Stage 1: Ingestion
    - Scan PDF directory for new files
    - Track processed files to avoid duplicates
    
    Stage 2: Extraction
    - Extract transactions from PDFs using pdfplumber
    - Handle various bank statement formats
    
    Stage 3: Normalization
    - Standardize date formats
    - Calculate signed amounts
    - Clean descriptions
    
    Stage 4: Storage
    - Insert into SQLite ledger
    - Maintain audit trail
    
    Stage 5: Categorization
    - Apply rule-based categorization first (fast)
    - Use LLM for remaining transactions (accurate)
    
    Stage 6: Analysis
    - Detect recurring payments
    - Identify anomalies
    - Generate financial summaries
    
    Stage 7: Reporting
    - Export to Excel with multiple sheets
    - Include all analysis results
    """
    
    def __init__(
        self,
        config: Optional[Config] = None,
        use_llm: bool = True
    ):
        """
        Initialize the pipeline.
        
        Args:
            config: Configuration object
            use_llm: Whether to use LLM for categorization
        """
        self.config = config or Config()
        self.use_llm = use_llm
        
        # Initialize components
        self.ledger = Ledger(self.config)
        self.extractor = PDFTransactionExtractor()
        self.normalizer = TransactionNormalizer()
        self.rule_categorizer = RuleCategorizer(self.config)
        self.llm_categorizer = LLMCategorizer(self.config, ledger=self.ledger) if use_llm else None
        self.recurring_detector = RecurringPaymentDetector(self.config, self.ledger)
        self.anomaly_detector = AnomalyDetector(self.config, self.ledger)
        self.financial_analyzer = FinancialAnalyzer(self.config, self.ledger)
        self.report_generator = ExcelReportGenerator(self.config, self.ledger)
        
        # Track processed files
        self.processed_files = set(self.ledger.get_source_files())
        
        logger.info("AI Pipeline initialized")
    
    def run(
        self,
        pdf_paths: Optional[List[str]] = None,
        generate_report: bool = True,
        report_path: Optional[Path] = None
    ) -> PipelineStats:
        """
        Run the full pipeline.
        
        Args:
            pdf_paths: List of PDF file paths to process.
                      If None, processes all PDFs in the pdf_dir.
            generate_report: Whether to generate Excel report
            report_path: Custom output path for the report
        
        Returns:
            PipelineStats with execution results
        """
        stats = PipelineStats()
        start_time = time.time()
        
        logger.info("=" * 60)
        logger.info("Starting AI Accountant Pipeline")
        logger.info("=" * 60)
        
        try:
            # Stage 1: Get PDF files to process
            pdf_files = self._get_pdf_files(pdf_paths)
            stats.pdfs_processed = len(pdf_files)
            
            if not pdf_files:
                logger.info("No PDF files to process")
                stats.end_time = datetime.now().isoformat()
                stats.duration_seconds = time.time() - start_time
                return stats
            
            logger.info(f"Found {len(pdf_files)} PDF files to process")
            
            # Stage 2-4: Process each PDF
            for pdf_path in pdf_files:
                self._process_pdf(pdf_path, stats)
            
            # Stage 5: Categorize uncategorized transactions
            if self.use_llm:
                self._categorize_remaining(stats)
            
            # Stage 6: Analysis
            self._run_analysis(stats)
            
            # Stage 7: Generate report
            if generate_report:
                stats.report_generated = str(
                    self._generate_report(report_path, stats)
                )
            
        except Exception as e:
            logger.exception(f"Pipeline error: {e}")
            stats.errors.append(str(e))
        
        # Finalize stats
        stats.end_time = datetime.now().isoformat()
        stats.duration_seconds = time.time() - start_time
        
        # Log summary
        self._log_summary(stats)
        
        return stats
    
    def _get_pdf_files(self, pdf_paths: Optional[List[str]] = None) -> List[Path]:
        """
        Get list of PDF files to process.
        
        Args:
            pdf_paths: Explicit list of paths, or None to scan directory
        
        Returns:
            List of PDF file paths
        """
        if pdf_paths:
            return [Path(p) for p in pdf_paths if Path(p).exists()]
        
        # Scan PDF directory
        pdf_files = list(self.config.pdf_dir.glob("*.pdf"))
        
        # Filter out already processed files
        new_files = [
            f for f in pdf_files
            if f.name not in self.processed_files
        ]
        
        return new_files
    
    def _process_pdf(self, pdf_path: Path, stats: PipelineStats):
        """
        Process a single PDF file through extraction, normalization, and storage.
        
        Args:
            pdf_path: Path to PDF file
            stats: Pipeline statistics to update
        """
        logger.info(f"Processing: {pdf_path.name}")
        
        # Stage 2: Extract transactions
        raw_transactions = self.extractor.extract_from_file(str(pdf_path))
        stats.transactions_extracted += len(raw_transactions)
        logger.info(f"  Extracted {len(raw_transactions)} transactions")
        
        if not raw_transactions:
            logger.warning(f"  No transactions extracted from {pdf_path.name}")
            return
        
        # Stage 3: Normalize transactions
        normalized = self.normalizer.normalize_batch(
            raw_transactions,
            source_file=pdf_path.name
        )
        stats.transactions_normalized += len(normalized)
        logger.info(f"  Normalized {len(normalized)} transactions")
        
        if not normalized:
            logger.warning(f"  No transactions normalized from {pdf_path.name}")
            return
        
        # Stage 4: Store in ledger
        # Convert to format expected by ledger
        ledger_txns = [
            {
                'date': t['date'],
                'description': t['description'],
                'amount': t['amount'],
                'account': t.get('account', 'Unknown'),
                'category': 'Needs Review'
            }
            for t in normalized
        ]
        
        inserted = self.ledger.insert_transactions(ledger_txns, source_file=pdf_path.name)
        logger.info(f"  Stored {inserted} transactions in ledger")
        
        # Mark as processed
        self.processed_files.add(pdf_path.name)
    
    def _categorize_remaining(self, stats: PipelineStats):
        """
        Categorize transactions that weren't categorized by rules.

        Args:
            stats: Pipeline statistics to update
        """
        logger.info("Running categorization...")

        # Stage 5a: Rule-based categorization
        uncategorized = self.ledger.get_uncategorized_transactions()
        remaining = []  # Initialise here so it's always defined for Stage 5b

        if uncategorized:
            categorized, remaining = self.rule_categorizer.categorize_batch(uncategorized)
            stats.transactions_categorized_rules += len(categorized)
            logger.info(f"  Rule-based: {len(categorized)} categorized")

            # Update ledger with rule-based categories
            updates = [(t['id'], t['category']) for t in categorized]
            if updates:
                self.ledger.update_categories_batch(updates)

        # Stage 5b: LLM categorization
        if self.use_llm and remaining:
            logger.info(f"  Sending {len(remaining)} transactions to LLM...")
            try:
                categorized_count = self.llm_categorizer.categorize_uncategorized()
                stats.transactions_categorized_llm += categorized_count
                logger.info(f"  LLM-based: {categorized_count} categorized")
                if categorized_count < len(remaining):
                    logger.warning(
                        "  LLM categorized only %d of %d transactions; "
                        "%d remain as 'Needs Review'. "
                        "Check that the llama.cpp server is running.",
                        categorized_count,
                        len(remaining),
                        len(remaining) - categorized_count,
                    )
            except Exception as e:
                logger.error(
                    "  LLM categorization failed with an unexpected error: %s. "
                    "%d transactions remain as 'Needs Review'.",
                    e,
                    len(remaining),
                )
                stats.errors.append(f"LLM categorization error: {e}")
    
    def _run_analysis(self, stats: PipelineStats):
        """
        Run analysis: recurring payments and anomaly detection.
        
        Args:
            stats: Pipeline statistics to update
        """
        logger.info("Running analysis...")
        
        # Recurring payment detection
        recurring = self.recurring_detector.detect_all()
        stats.recurring_payments_detected = len(recurring)
        logger.info(f"  Detected {len(recurring)} recurring payments")
        
        # Anomaly detection
        anomalies = self.anomaly_detector.detect_all()
        stats.anomalies_detected = len(anomalies)
        logger.info(f"  Detected {len(anomalies)} anomalies")
    
    def _generate_report(
        self,
        report_path: Optional[Path],
        stats: PipelineStats
    ) -> Path:
        """
        Generate Excel report.
        
        Args:
            report_path: Custom output path
            stats: Pipeline statistics
        
        Returns:
            Path to generated report
        """
        logger.info("Generating Excel report...")
        
        report_config = ReportConfig(
            include_all_transactions=True,
            include_category_summary=True,
            include_monthly_summary=True,
            include_recurring_payments=stats.recurring_payments_detected > 0,
            include_large_transactions=True,
            include_anomalies=stats.anomalies_detected > 0,
            include_financial_health=True
        )
        
        output_path = self.report_generator.generate_report(
            output_path=report_path,
            report_config=report_config
        )
        
        logger.info(f"  Report saved to: {output_path}")
        
        return output_path
    
    def _log_summary(self, stats: PipelineStats):
        """Log pipeline execution summary."""
        logger.info("=" * 60)
        logger.info("Pipeline Execution Summary")
        logger.info("=" * 60)
        logger.info(f"  Duration: {stats.duration_seconds:.2f} seconds")
        logger.info(f"  PDFs Processed: {stats.pdfs_processed}")
        logger.info(f"  Transactions Extracted: {stats.transactions_extracted}")
        logger.info(f"  Transactions Normalized: {stats.transactions_normalized}")
        logger.info(f"  Categorized (Rules): {stats.transactions_categorized_rules}")
        logger.info(f"  Categorized (LLM): {stats.transactions_categorized_llm}")
        logger.info(f"  Recurring Payments: {stats.recurring_payments_detected}")
        logger.info(f"  Anomalies: {stats.anomalies_detected}")
        logger.info(f"  Report: {stats.report_generated or 'Not generated'}")
        
        if stats.errors:
            logger.warning(f"  Errors: {len(stats.errors)}")
            for error in stats.errors:
                logger.warning(f"    - {error}")
        
        logger.info("=" * 60)
    
    def process_single_pdf(
        self,
        pdf_path: str,
        categorize: bool = True,
        generate_report: bool = False
    ) -> Dict[str, Any]:
        """
        Process a single PDF file.
        
        Args:
            pdf_path: Path to PDF file
            categorize: Whether to categorize transactions
            generate_report: Whether to generate report
        
        Returns:
            Dictionary with processing results
        """
        stats = PipelineStats()
        
        pdf_path = Path(pdf_path)
        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF not found: {pdf_path}")
        
        self._process_pdf(pdf_path, stats)
        
        if categorize:
            self._categorize_remaining(stats)
        
        if generate_report:
            stats.report_generated = str(self._generate_report(None, stats))
        
        return {
            'success': stats.success,
            'transactions_extracted': stats.transactions_extracted,
            'transactions_normalized': stats.transactions_normalized,
            'errors': stats.errors
        }
    
    def get_ledger_summary(self) -> Dict[str, Any]:
        """
        Get summary of current ledger state.
        
        Returns:
            Dictionary with ledger statistics
        """
        total = self.ledger.get_transaction_count()
        uncategorized = len(self.ledger.get_uncategorized_transactions())
        date_range = self.ledger.get_date_range()
        
        return {
            'total_transactions': total,
            'uncategorized': uncategorized,
            'categorized': total - uncategorized,
            'date_range': date_range,
            'source_files': self.ledger.get_source_files()
        }
    
    def close(self):
        """Clean up resources."""
        if self.llm_categorizer:
            self.llm_categorizer.close()
    
    def __enter__(self):
        """Context manager entry."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()


def run_pipeline(
    pdf_paths: Optional[List[str]] = None,
    generate_report: bool = True,
    use_llm: bool = True,
    config: Optional[Config] = None
) -> PipelineStats:
    """
    Convenience function to run the pipeline.
    
    Args:
        pdf_paths: List of PDF paths to process
        generate_report: Whether to generate Excel report
        use_llm: Whether to use LLM for categorization
        config: Configuration object
    
    Returns:
        PipelineStats with execution results
    """
    pipeline = AIPipeline(config=config, use_llm=use_llm)
    try:
        return pipeline.run(pdf_paths, generate_report)
    finally:
        pipeline.close()
