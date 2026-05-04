"""
PDF Transaction Extraction Module.

Extracts transaction data from bank statement PDFs using pdfplumber.
Handles various bank statement formats and normalizes the output.

Supported formats:
- Table-based statements (most common)
- Text-based statements
- Multi-page statements
"""

import re
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime

import pdfplumber

logger = logging.getLogger(__name__)


@dataclass
class RawTransaction:
    """Container for a raw extracted transaction."""
    date: str
    description: str
    debit: Optional[float]
    credit: Optional[float]
    balance: Optional[float]
    page: int
    raw_text: str


class PDFTransactionExtractor:
    """
    Extract transactions from bank statement PDFs.
    
    The extractor uses multiple strategies to handle different
    bank statement formats:
    1. Table extraction (preferred)
    2. Text pattern matching (fallback)
    3. Line-by-line parsing (last resort)
    
    The goal is to extract: date, description, debit, credit, balance
    """
    
    # Common date patterns
    DATE_PATTERNS = [
        r'\d{2}/\d{2}/\d{4}',      # DD/MM/YYYY or MM/DD/YYYY
        r'\d{2}-\d{2}-\d{4}',      # DD-MM-YYYY or MM-DD-YYYY
        r'\d{4}-\d{2}-\d{2}',      # YYYY-MM-DD (ISO)
        r'\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4}',  # DD Mon YYYY
        r'\d{1,2}\s+[A-Za-z]+\s+\d{2,4}',    # DD Month YYYY
    ]
    
    # Amount patterns (handles various formats)
    AMOUNT_PATTERN = r'[\$₹€£]?\s*[\d,]+\.?\d*'
    
    # Keywords that indicate transaction rows
    TRANSACTION_KEYWORDS = [
        'debit', 'credit', 'withdrawal', 'deposit',
        'payment', 'transfer', 'purchase', 'fee',
        'interest', 'salary', 'refund', 'charge'
    ]
    
    def __init__(self):
        """Initialize the PDF extractor."""
        self.extraction_stats = {
            'total_pages': 0,
            'tables_found': 0,
            'transactions_extracted': 0
        }
    
    def extract_from_file(self, pdf_path: str, password: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Extract all transactions from a PDF file.

        Args:
            pdf_path: Path to the PDF file
            password: Optional password for encrypted PDFs

        Returns:
            List of transaction dictionaries
        """
        pdf_path = Path(pdf_path)

        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF not found: {pdf_path}")

        logger.info(f"Extracting transactions from {pdf_path.name}")

        all_transactions = []

        open_kwargs = {}
        if password:
            open_kwargs["password"] = password

        try:
            with pdfplumber.open(pdf_path, **open_kwargs) as pdf:
                self.extraction_stats['total_pages'] = len(pdf.pages)
                
                for page_num, page in enumerate(pdf.pages, 1):
                    logger.debug(f"Processing page {page_num}/{len(pdf.pages)}")
                    
                    # Try table extraction first
                    page_transactions = self._extract_from_page(page, page_num)
                    all_transactions.extend(page_transactions)
            
            self.extraction_stats['transactions_extracted'] = len(all_transactions)
            logger.info(
                f"Extracted {len(all_transactions)} transactions "
                f"from {len(pdf.pages)} pages"
            )

            # OCR fallback — try Tesseract if pdfplumber found nothing
            if len(all_transactions) == 0:
                logger.info("No transactions via pdfplumber — attempting OCR fallback")
                from scripts.extract_pdf_ocr import extract_via_ocr
                from core.config import Config
                cfg = Config()
                if cfg.ocr_enabled:
                    try:
                        ocr_txns = extract_via_ocr(str(pdf_path), password=password)
                        if ocr_txns:
                            logger.info(f"OCR recovered {len(ocr_txns)} transactions")
                            all_transactions = ocr_txns
                            all_transactions = [{'ocr_used': True, **t} for t in all_transactions]
                    except Exception as ocr_err:
                        logger.warning("OCR fallback failed: %s", ocr_err)

        except Exception as e:
            logger.error(f"Error extracting from {pdf_path}: {e}")
            raise
        
        return all_transactions
    
    def _extract_from_page(
        self,
        page: pdfplumber.page.Page,
        page_num: int
    ) -> List[Dict[str, Any]]:
        """
        Extract transactions from a single page.
        
        Args:
            page: pdfplumber page object
            page_num: Page number (1-indexed)
        
        Returns:
            List of transaction dictionaries
        """
        transactions = []
        
        # Strategy 1: Extract tables
        tables = page.extract_tables()
        
        if tables:
            self.extraction_stats['tables_found'] += len(tables)
            for table in tables:
                table_transactions = self._parse_table(table, page_num)
                transactions.extend(table_transactions)
        
        # Strategy 2: If no tables found, try text extraction
        if not transactions:
            text = page.extract_text()
            if text:
                text_transactions = self._parse_text(text, page_num)
                transactions.extend(text_transactions)
        
        return transactions
    
    def _parse_table(
        self,
        table: List[List[str]],
        page_num: int
    ) -> List[Dict[str, Any]]:
        """
        Parse a table into transactions.
        
        Args:
            table: List of rows, each row is a list of cell values
            page_num: Page number
        
        Returns:
            List of transaction dictionaries
        """
        transactions = []
        
        if len(table) < 2:
            return transactions
        
        # Identify column indices
        header_row = table[0]
        col_indices = self._identify_columns(header_row)
        
        if not col_indices:
            # Try to infer from data rows
            col_indices = self._infer_columns(table)
        
        # Process data rows
        for row_idx, row in enumerate(table[1:], 1):
            if not row or all(cell is None for cell in row):
                continue
            
            txn = self._parse_row(row, col_indices, page_num)
            if txn:
                transactions.append(txn)
        
        return transactions
    
    def _identify_columns(self, header_row: List[str]) -> Optional[Dict[str, int]]:
        """
        Identify column indices from header row.
        
        Args:
            header_row: List of header cell values
        
        Returns:
            Dictionary mapping column names to indices, or None
        """
        if not header_row:
            return None
        
        indices = {}
        header_lower = [str(h).lower() if h else '' for h in header_row]
        
        # Map common header names to our standard names
        date_keywords = ['date', 'trans date', 'transaction date', 'value date']
        desc_keywords = ['description', 'particulars', 'narration', 'details', 'transaction']
        debit_keywords = ['debit', 'withdrawal', 'dr', 'amount (dr)']
        credit_keywords = ['credit', 'deposit', 'cr', 'amount (cr)']
        balance_keywords = ['balance', 'running balance', 'closing balance']
        
        for idx, header in enumerate(header_lower):
            if any(kw in header for kw in date_keywords):
                indices['date'] = idx
            elif any(kw in header for kw in desc_keywords):
                indices['description'] = idx
            elif any(kw in header for kw in debit_keywords):
                indices['debit'] = idx
            elif any(kw in header for kw in credit_keywords):
                indices['credit'] = idx
            elif any(kw in header for kw in balance_keywords):
                indices['balance'] = idx
        
        return indices if indices else None
    
    def _infer_columns(
        self,
        table: List[List[str]]
    ) -> Dict[str, int]:
        """
        Infer column mapping from data patterns.
        
        Args:
            table: Full table data
        
        Returns:
            Dictionary mapping column names to indices
        """
        indices = {}
        
        if len(table) < 2:
            return indices
        
        # Look at first few data rows
        sample_rows = table[1:min(5, len(table))]
        
        for col_idx in range(len(table[0])):
            values = [row[col_idx] for row in sample_rows if len(row) > col_idx and row[col_idx]]
            
            if not values:
                continue
            
            # Check if column contains dates
            if any(self._is_date(str(v)) for v in values):
                indices['date'] = col_idx
            
            # Check if column contains amounts
            elif any(self._is_amount(str(v)) for v in values):
                # Determine if debit or credit based on context
                if 'debit' not in indices and 'credit' not in indices:
                    indices['debit'] = col_idx  # Default to debit
                elif 'debit' in indices:
                    indices['credit'] = col_idx
            
            # Check if column looks like description (text with spaces)
            elif any(len(str(v)) > 10 and not self._is_amount(str(v)) for v in values):
                if 'description' not in indices:
                    indices['description'] = col_idx
        
        return indices
    
    def _parse_row(
        self,
        row: List[str],
        col_indices: Dict[str, int],
        page_num: int
    ) -> Optional[Dict[str, Any]]:
        """
        Parse a single table row into a transaction.
        
        Args:
            row: List of cell values
            col_indices: Column index mapping
            page_num: Page number
        
        Returns:
            Transaction dictionary or None
        """
        def get_value(key: str) -> Optional[str]:
            idx = col_indices.get(key)
            if idx is not None and idx < len(row):
                val = row[idx]
                return str(val).strip() if val else None
            return None
        
        date_str = get_value('date')
        description = get_value('description')
        debit_str = get_value('debit')
        credit_str = get_value('credit')
        balance_str = get_value('balance')
        
        # Skip if no date or description
        if not date_str or not description:
            return None
        
        # Parse date
        parsed_date = self._parse_date(date_str)
        if not parsed_date:
            return None
        
        # Parse amounts
        debit = self._parse_amount(debit_str) if debit_str else None
        credit = self._parse_amount(credit_str) if credit_str else None
        balance = self._parse_amount(balance_str) if balance_str else None
        
        # Clean description
        description = self._clean_description(description)
        
        return {
            'date': parsed_date,
            'description': description,
            'debit': debit,
            'credit': credit,
            'balance': balance,
            'page': page_num
        }
    
    def _parse_text(
        self,
        text: str,
        page_num: int
    ) -> List[Dict[str, Any]]:
        """
        Parse text content for transactions (fallback method).
        
        Args:
            text: Extracted text from page
            page_num: Page number
        
        Returns:
            List of transaction dictionaries
        """
        transactions = []
        lines = text.split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Try to find date at start of line
            date_match = None
            for pattern in self.DATE_PATTERNS:
                match = re.match(pattern, line)
                if match:
                    date_match = match.group()
                    break
            
            if not date_match:
                continue
            
            # Try to find amounts in the line
            amounts = re.findall(self.AMOUNT_PATTERN, line)
            
            if len(amounts) >= 1:
                # Simple heuristic: first amount is debit, second is credit
                debit = self._parse_amount(amounts[0]) if len(amounts) >= 1 else None
                credit = self._parse_amount(amounts[1]) if len(amounts) >= 2 else None
                
                # Description is everything between date and amounts
                desc_start = len(date_match)
                desc_end = line.find(amounts[0]) if amounts else len(line)
                description = line[desc_start:desc_end].strip()
                
                parsed_date = self._parse_date(date_match)
                if parsed_date:
                    transactions.append({
                        'date': parsed_date,
                        'description': self._clean_description(description),
                        'debit': debit,
                        'credit': credit,
                        'balance': None,
                        'page': page_num
                    })
        
        return transactions
    
    def _parse_date(self, date_str: str) -> Optional[str]:
        """
        Parse various date formats to YYYY-MM-DD.
        
        Args:
            date_str: Date string in various formats
        
        Returns:
            ISO format date string or None
        """
        if not date_str:
            return None
        
        date_str = date_str.strip()
        
        # Try various formats
        formats = [
            '%d/%m/%Y', '%m/%d/%Y', '%d-%m-%Y', '%m-%d-%Y',
            '%Y-%m-%d', '%Y/%m/%d',
            '%d %b %Y', '%d %B %Y',
            '%d %b %y', '%d %B %y'
        ]
        
        for fmt in formats:
            try:
                dt = datetime.strptime(date_str, fmt)
                return dt.strftime('%Y-%m-%d')
            except ValueError:
                continue
        
        # Handle 2-digit years
        if re.match(r'\d{1,2}/\d{1,2}/\d{2}$', date_str):
            try:
                dt = datetime.strptime(date_str, '%d/%m/%y')
                return dt.strftime('%Y-%m-%d')
            except ValueError:
                pass
        
        logger.warning(f"Could not parse date: {date_str}")
        return None
    
    def _parse_amount(self, amount_str: str) -> Optional[float]:
        """
        Parse amount string to float.
        
        Args:
            amount_str: Amount string (may include currency symbols, commas)
        
        Returns:
            Float value or None
        """
        if not amount_str:
            return None
        
        # Remove currency symbols and whitespace
        cleaned = re.sub(r'[\$₹€£,\s]', '', str(amount_str))
        
        # Handle parentheses for negative (common in accounting)
        if cleaned.startswith('(') and cleaned.endswith(')'):
            cleaned = '-' + cleaned[1:-1]
        
        try:
            return float(cleaned)
        except ValueError:
            logger.debug(f"Could not parse amount: {amount_str}")
            return None
    
    def _clean_description(self, description: str) -> str:
        """
        Clean and normalize transaction description.
        
        Args:
            description: Raw description string
        
        Returns:
            Cleaned description
        """
        if not description:
            return ''
        
        # Remove extra whitespace
        description = ' '.join(description.split())
        
        # Remove common artifacts
        artifacts = ['*', '|', '-', '–', '—']
        for artifact in artifacts:
            description = description.replace(artifact, ' ')
        
        # Remove trailing special characters
        description = description.rstrip(' .-:;')

        # Truncate to a safe maximum length
        if len(description) > 200:
            description = description[:200]

        return description.strip()
    
    def _is_date(self, text: str) -> bool:
        """Check if text looks like a date."""
        for pattern in self.DATE_PATTERNS:
            if re.match(pattern, text):
                return True
        return False
    
    def _is_amount(self, text: str) -> bool:
        """Check if text looks like an amount."""
        if not text:
            return False
        return bool(re.match(r'^[\$₹€£]?\s*[\d,]+\.?\d*$', str(text)))
    
    def get_stats(self) -> Dict[str, int]:
        """Get extraction statistics."""
        return self.extraction_stats.copy()


def extract_pdf_transactions(pdf_path: str) -> List[Dict[str, Any]]:
    """
    Convenience function to extract transactions from a PDF.
    
    Args:
        pdf_path: Path to the PDF file
    
    Returns:
        List of transaction dictionaries
    """
    extractor = PDFTransactionExtractor()
    return extractor.extract_from_file(pdf_path)
