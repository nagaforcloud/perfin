"""
Tests for the main pipeline.

Tests cover:
- Pipeline execution
- PDF processing flow
- Error handling
"""

import pytest
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.pipeline import AIPipeline, PipelineStats
from core.config import Config


class TestPipelineInitialization:
    """Test pipeline initialization."""

    def test_initializes_with_config(self, test_config):
        """Test pipeline initializes with config."""
        pipeline = AIPipeline(config=test_config, use_llm=False)
        
        assert pipeline.config is test_config
        assert pipeline.ledger is not None
        assert pipeline.extractor is not None

    def test_initializes_without_llm(self, test_config):
        """Test pipeline can run without LLM."""
        pipeline = AIPipeline(config=test_config, use_llm=False)
        
        assert pipeline.use_llm is False
        assert pipeline.llm_categorizer is None

    def test_loads_processed_files(self, test_config, ledger):
        """Test that previously processed files are tracked."""
        # Insert a transaction with source file
        ledger.insert_transactions(
            [{'date': '2024-01-15', 'description': 'Test', 'amount': -50}],
            source_file="already_processed.pdf"
        )
        
        pipeline = AIPipeline(config=test_config, use_llm=False)
        
        assert "already_processed.pdf" in pipeline.processed_files


class TestPipelineExecution:
    """Test pipeline execution."""

    @patch('core.pipeline.PDFTransactionExtractor')
    def test_runs_without_pdfs(self, mock_extractor, test_config):
        """Test pipeline handles empty PDF directory."""
        pipeline = AIPipeline(config=test_config, use_llm=False)
        stats = pipeline.run()
        
        assert stats.pdfs_processed == 0
        assert stats.success is True

    @patch('core.pipeline.PDFTransactionExtractor')
    @patch('core.pipeline.TransactionNormalizer')
    def test_processes_single_pdf(
        self, 
        mock_normalizer, 
        mock_extractor,
        test_config
    ):
        """Test processing a single PDF."""
        # Mock extractor
        mock_extractor.return_value.extract_from_file.return_value = [
            {
                'date': '2024-01-15',
                'description': 'Test Transaction',
                'debit': 50.0,
                'credit': None,
                'balance': None,
                'page': 1
            }
        ]
        
        # Mock normalizer
        mock_normalizer.return_value.normalize_batch.return_value = [
            {
                'date': '2024-01-15',
                'description': 'Test Transaction',
                'amount': -50.0,
                'account': 'Primary',
                'source_file': 'test.pdf'
            }
        ]
        
        # Create a test PDF file
        test_config.pdf_dir.mkdir(parents=True, exist_ok=True)
        test_pdf = test_config.pdf_dir / "test.pdf"
        test_pdf.write_bytes(b"%PDF fake pdf content")
        
        pipeline = AIPipeline(config=test_config, use_llm=False)
        stats = pipeline.run(pdf_paths=[str(test_pdf)])
        
        assert stats.pdfs_processed == 1
        assert stats.transactions_extracted == 1
        assert stats.transactions_normalized == 1

    def test_tracks_processed_files(self, test_config):
        """Test that processed files are tracked."""
        pipeline = AIPipeline(config=test_config, use_llm=False)
        
        # Initially no files
        assert len(pipeline.processed_files) == 0


class TestPipelineStats:
    """Test pipeline statistics."""

    def test_stats_initialization(self):
        """Test stats are initialized correctly."""
        stats = PipelineStats()
        
        assert stats.pdfs_processed == 0
        assert stats.transactions_extracted == 0
        assert stats.errors == []
        assert stats.success is True

    def test_success_property(self):
        """Test success property."""
        stats = PipelineStats()
        assert stats.success is True
        
        stats.errors.append("Test error")
        assert stats.success is False


class TestPDFFiltering:
    """Test PDF file filtering."""

    def test_filters_already_processed(self, test_config, ledger):
        """Test that already processed files are skipped."""
        # Mark a file as processed
        ledger.insert_transactions(
            [{'date': '2024-01-15', 'description': 'Test', 'amount': -50}],
            source_file="processed.pdf"
        )
        
        pipeline = AIPipeline(config=test_config, use_llm=False)
        
        # Create both processed and new files
        (test_config.pdf_dir / "processed.pdf").write_bytes(b"%PDF")
        (test_config.pdf_dir / "new.pdf").write_bytes(b"%PDF")
        
        pdf_files = pipeline._get_pdf_files()
        
        # Only new file should be returned
        file_names = [f.name for f in pdf_files]
        assert "processed.pdf" not in file_names
        assert "new.pdf" in file_names

    def test_explicit_pdf_paths(self, test_config):
        """Test explicit PDF path specification."""
        pipeline = AIPipeline(config=test_config, use_llm=False)
        
        # Create test files
        test_config.pdf_dir.mkdir(parents=True, exist_ok=True)
        pdf1 = test_config.pdf_dir / "test1.pdf"
        pdf2 = test_config.pdf_dir / "test2.pdf"
        pdf1.write_bytes(b"%PDF")
        pdf2.write_bytes(b"%PDF")
        
        # Request specific file
        pdf_files = pipeline._get_pdf_files(pdf_paths=[str(pdf1)])
        
        assert len(pdf_files) == 1
        assert pdf_files[0].name == "test1.pdf"


class TestErrorHandling:
    """Test pipeline error handling."""

    @patch('core.pipeline.PDFTransactionExtractor')
    def test_handles_extraction_error(
        self, 
        mock_extractor, 
        test_config
    ):
        """Test pipeline handles extraction errors."""
        mock_extractor.return_value.extract_from_file.side_effect = Exception(
            "Extraction failed"
        )
        
        # Create a test PDF
        test_config.pdf_dir.mkdir(parents=True, exist_ok=True)
        test_pdf = test_config.pdf_dir / "test.pdf"
        test_pdf.write_bytes(b"%PDF")
        
        pipeline = AIPipeline(config=test_config, use_llm=False)
        stats = pipeline.run(pdf_paths=[str(test_pdf)])
        
        # Should have error recorded but not crash
        assert len(stats.errors) >= 1


class TestLedgerSummary:
    """Test ledger summary functionality."""

    def test_gets_ledger_summary(self, populated_ledger, test_config):
        """Test getting ledger summary."""
        pipeline = AIPipeline(config=test_config, use_llm=False)
        pipeline.ledger = populated_ledger
        
        summary = pipeline.get_ledger_summary()
        
        assert 'total_transactions' in summary
        assert 'uncategorized' in summary
        assert 'categorized' in summary
        assert summary['total_transactions'] == 5
