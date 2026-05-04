"""
CSV Bank Statement Extractor.

Auto-detects column layout from common Indian and international bank formats:
  - HDFC / ICICI / SBI / Axis style: Date, Narration, Chq/Ref No., Value Date,
                                      Withdrawal, Deposit, Closing Balance
  - Standard single-amount style:     Date, Description, Amount, Balance
  - International style:              Date, Payee, Category, Memo, Outflow, Inflow

Produces the same raw-transaction dict schema as extract_pdf.py so the rest
of the pipeline can treat all sources uniformly.
"""

import csv
import io
import logging
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Column name patterns (case-insensitive substring matches, ordered by priority)
# ---------------------------------------------------------------------------
DATE_PATTERNS = [
    "transaction date", "txn date", "date", "trans date", "value date",
    "posting date", "booking date",
]
DESC_PATTERNS = [
    "narration", "description", "particulars", "details", "transaction details",
    "payee", "remarks", "narrative", "transaction description", "memo",
]
DEBIT_PATTERNS = [
    "withdrawal", "debit", "debit amount", "withdrawal amt", "outflow",
    "amount (dr)", "dr amount", "amount dr",
]
CREDIT_PATTERNS = [
    "deposit", "credit", "credit amount", "deposit amt", "inflow",
    "amount (cr)", "cr amount", "amount cr",
]
AMOUNT_PATTERNS = [
    "amount", "transaction amount", "net amount", "txn amount",
]
BALANCE_PATTERNS = [
    "balance", "closing balance", "available balance", "running balance",
]


def _col_index(headers: List[str], patterns: List[str]) -> Optional[int]:
    """Return the first header index that contains any of the given patterns."""
    headers_lower = [h.lower().strip() for h in headers]
    for pattern in patterns:
        for i, h in enumerate(headers_lower):
            if pattern in h:
                return i
    return None


def _parse_amount(value: Optional[str]) -> Optional[float]:
    """Convert a string amount to float, stripping currency symbols and commas."""
    if value is None:
        return None
    v = str(value).strip()
    if not v or v in ("-", "--", "nil", "n/a", ""):
        return None
    # Remove currency symbols, commas, spaces
    v = re.sub(r"[₹$€£¥,\s]", "", v)
    # Handle trailing DR/CR indicators
    is_dr = v.upper().endswith("DR")
    is_cr = v.upper().endswith("CR")
    v = re.sub(r"(?i)(dr|cr)$", "", v).strip()
    try:
        amount = float(v)
        if is_dr:
            amount = -abs(amount)
        elif is_cr:
            amount = abs(amount)
        return amount
    except ValueError:
        return None


def _parse_date(value: Optional[str]) -> Optional[str]:
    """Try to parse a date string into YYYY-MM-DD."""
    if not value:
        return None
    v = str(value).strip()
    formats = [
        "%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%d", "%d-%m-%Y", "%m-%d-%Y",
        "%d/%m/%y", "%m/%d/%y", "%d-%m-%y",
        "%d %b %Y", "%d %B %Y", "%d %b %y", "%d %B %y",
        "%Y/%m/%d",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(v, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def _find_header_in_rows(rows: List[List[str]]) -> Tuple[Optional[List[str]], int]:
    """
    Scan a list of pre-split rows for the one that looks like a CSV header.

    Returns (header_row, row_index) or (None, 0).
    """
    all_patterns = (DATE_PATTERNS + DESC_PATTERNS + DEBIT_PATTERNS +
                    CREDIT_PATTERNS + AMOUNT_PATTERNS + BALANCE_PATTERNS)
    best_score = 0
    best_idx = 0
    best_row: Optional[List[str]] = None

    for idx, row in enumerate(rows[:30]):
        row_lower = " ".join(c.lower().strip() for c in row)
        score = sum(1 for p in all_patterns if p in row_lower)
        if score > best_score:
            best_score = score
            best_idx = idx
            best_row = row

    if best_score >= 2:
        return best_row, best_idx
    return None, 0


def _map_columns(headers: List[str]) -> Dict[str, Optional[int]]:
    """Map logical column roles to actual column indices."""
    return {
        "date":    _col_index(headers, DATE_PATTERNS),
        "desc":    _col_index(headers, DESC_PATTERNS),
        "debit":   _col_index(headers, DEBIT_PATTERNS),
        "credit":  _col_index(headers, CREDIT_PATTERNS),
        "amount":  _col_index(headers, AMOUNT_PATTERNS),
        "balance": _col_index(headers, BALANCE_PATTERNS),
    }


class CSVTransactionExtractor:
    """
    Extracts transactions from CSV bank statements.

    Supports both file paths and in-memory strings/bytes.
    """

    def extract_from_file(self, file_path: str) -> List[Dict[str, Any]]:
        """
        Extract transactions from a CSV file on disk.

        Args:
            file_path: Path to the CSV file

        Returns:
            List of raw transaction dicts
        """
        path = Path(file_path)
        # Try UTF-8 first, fall back to latin-1 (common in Indian bank exports)
        for encoding in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
            try:
                text = path.read_text(encoding=encoding)
                return self.extract_from_string(text, source_name=path.name)
            except UnicodeDecodeError:
                continue
        raise ValueError(f"Cannot decode {file_path} with any supported encoding")

    def extract_from_bytes(self, data: bytes, source_name: str = "upload.csv") -> List[Dict[str, Any]]:
        """Extract from raw bytes (e.g. an HTTP upload)."""
        for encoding in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
            try:
                return self.extract_from_string(data.decode(encoding), source_name=source_name)
            except UnicodeDecodeError:
                continue
        raise ValueError("Cannot decode CSV bytes")

    def extract_from_string(self, text: str, source_name: str = "upload.csv") -> List[Dict[str, Any]]:
        """
        Core extraction logic from a string of CSV content.

        Scans through lines to find the header row (skipping bank summary
        metadata at the top that many Indian banks prepend).
        """
        lines = text.splitlines()
        header_row, header_idx = self._find_header(lines)
        if header_row is None:
            logger.warning(f"{source_name}: could not locate a header row")
            return []

        # Re-parse from the header line onward
        data_text = "\n".join(lines[header_idx:])
        reader = csv.reader(io.StringIO(data_text))
        rows = list(reader)
        if len(rows) < 2:
            return []

        headers = rows[0]
        col = self._map_columns(headers)
        logger.info(f"{source_name}: columns detected → {col}")

        transactions = []
        for row_num, row in enumerate(rows[1:], start=header_idx + 2):
            txn = self._parse_row(row, col, row_num)
            if txn:
                transactions.append(txn)

        logger.info(f"{source_name}: extracted {len(transactions)} transactions")
        return transactions

    # -----------------------------------------------------------------------
    # Private helpers
    # -----------------------------------------------------------------------

    def _find_header(self, lines: List[str]) -> Tuple[Optional[List[str]], int]:
        """Scan CSV text lines for the header row."""
        row_lists = []
        for line in lines[:30]:
            try:
                row_lists.append(next(csv.reader([line])))
            except StopIteration:
                row_lists.append([])
        header_row, idx = _find_header_in_rows(row_lists)
        return header_row, idx

    def _map_columns(self, headers: List[str]) -> Dict[str, Optional[int]]:
        """Map logical column roles to actual column indices."""
        return _map_columns(headers)

    def _parse_row(
        self,
        row: List[str],
        col: Dict[str, Optional[int]],
        row_num: int
    ) -> Optional[Dict[str, Any]]:
        """Parse a single CSV data row into a raw transaction dict."""

        def get(key: str) -> Optional[str]:
            idx = col.get(key)
            if idx is None or idx >= len(row):
                return None
            v = row[idx].strip()
            return v if v else None

        # Date
        date = _parse_date(get("date"))
        if not date:
            return None  # Can't use a row without a date

        # Description
        desc = get("desc")
        if not desc:
            return None

        # Amounts — try debit/credit columns first, fall back to single amount
        debit_raw = _parse_amount(get("debit"))
        credit_raw = _parse_amount(get("credit"))
        amount_raw = _parse_amount(get("amount"))
        balance_raw = _parse_amount(get("balance"))

        # Resolve to debit/credit pair
        if debit_raw is not None or credit_raw is not None:
            debit = abs(debit_raw) if debit_raw else None
            credit = abs(credit_raw) if credit_raw else None
        elif amount_raw is not None:
            # Single signed amount: negative = debit, positive = credit
            if amount_raw < 0:
                debit, credit = abs(amount_raw), None
            else:
                debit, credit = None, abs(amount_raw)
        else:
            # No amount — skip
            return None

        return {
            "date":    date,
            "description": desc,
            "debit":   debit,
            "credit":  credit,
            "balance": balance_raw,
            "page":    row_num,  # repurpose page field for row number
        }
