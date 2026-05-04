"""
Excel Bank Statement Extractor (.xlsx / .xls).

Wraps the CSV extractor logic: reads each sheet with openpyxl (for .xlsx) or
xlrd (for legacy .xls), converts to a CSV-like list of rows, then delegates
to CSVTransactionExtractor for column mapping and parsing.

Supports:
  - .xlsx (openpyxl)
  - .xls  (xlrd)
  - Multiple sheets: auto-selects the sheet with the most data rows
"""

import logging
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional

import openpyxl
import xlrd

from scripts.extract_csv import (
    CSVTransactionExtractor,
    _col_index,
    _find_header_in_rows,
    _map_columns,
    DATE_PATTERNS,
    DESC_PATTERNS,
    DEBIT_PATTERNS,
    CREDIT_PATTERNS,
    AMOUNT_PATTERNS,
    BALANCE_PATTERNS,
)

logger = logging.getLogger(__name__)


def _sheet_to_rows(sheet) -> List[List[str]]:
    """Convert an openpyxl worksheet to a list of string rows."""
    rows = []
    for row in sheet.iter_rows(values_only=True):
        str_row = [str(cell) if cell is not None else "" for cell in row]
        # Skip completely empty rows
        if any(c.strip() for c in str_row):
            rows.append(str_row)
    return rows


def _best_sheet(workbook: openpyxl.Workbook):
    """Return the worksheet that looks most like a transaction sheet."""
    all_patterns = (DATE_PATTERNS + DESC_PATTERNS + DEBIT_PATTERNS +
                    CREDIT_PATTERNS + AMOUNT_PATTERNS + BALANCE_PATTERNS)
    best_score = -1
    best_ws = workbook.active

    for ws in workbook.worksheets:
        rows = _sheet_to_rows(ws)
        if not rows:
            continue
        # Score the first 10 rows for pattern matches
        text = " ".join(" ".join(r) for r in rows[:10]).lower()
        score = sum(1 for p in all_patterns if p in text)
        if score > best_score:
            best_score = score
            best_ws = ws

    return best_ws


# ---------------------------------------------------------------------------
# Legacy .xls helpers (xlrd)
# ---------------------------------------------------------------------------

# Column headers that should never be used as a fallback description
_SERIAL_HEADERS = {"serial number", "sl no", "sl.no", "sl.no.", "s.no", "s.no.",
                   "sr no", "sr.no", "sr.no.", "sno", "no.", "no", "#"}


def _xls_cell_str(sheet: xlrd.sheet.Sheet, row_idx: int, col_idx: int, datemode: int) -> str:
    """Convert a single xlrd cell to a string, properly handling date cells."""
    cell_type = sheet.cell_type(row_idx, col_idx)
    value = sheet.cell_value(row_idx, col_idx)
    if cell_type == xlrd.XL_CELL_DATE:
        try:
            dt = xlrd.xldate_as_datetime(value, datemode)
            return dt.strftime("%d/%m/%Y")
        except Exception:
            return str(value)
    if cell_type == xlrd.XL_CELL_EMPTY or value == "":
        return ""
    # Avoid "1.0", "2.0" for plain integers
    if cell_type == xlrd.XL_CELL_NUMBER and float(value) == int(value):
        return str(int(value))
    return str(value)


def _xls_sheet_to_rows(sheet: xlrd.sheet.Sheet, datemode: int) -> List[List[str]]:
    """Convert an xlrd sheet to a list of string rows, handling date cells."""
    rows = []
    for i in range(sheet.nrows):
        str_row = [_xls_cell_str(sheet, i, j, datemode) for j in range(sheet.ncols)]
        if any(c.strip() for c in str_row):
            rows.append(str_row)
    return rows


def _best_xls_sheet(workbook: xlrd.Book) -> xlrd.sheet.Sheet:
    """Return the xlrd sheet that looks most like a transaction sheet."""
    all_patterns = (DATE_PATTERNS + DESC_PATTERNS + DEBIT_PATTERNS +
                    CREDIT_PATTERNS + AMOUNT_PATTERNS + BALANCE_PATTERNS)
    best_score = -1
    best_sheet = workbook.sheet_by_index(0)

    for i in range(workbook.nsheets):
        ws = workbook.sheet_by_index(i)
        rows = _xls_sheet_to_rows(ws, workbook.datemode)
        if not rows:
            continue
        text = " ".join(" ".join(r) for r in rows[:10]).lower()
        score = sum(1 for p in all_patterns if p in text)
        if score > best_score:
            best_score = score
            best_sheet = ws

    return best_sheet


class ExcelTransactionExtractor:
    """Extracts transactions from Excel bank statements."""

    def __init__(self):
        self._csv_extractor = CSVTransactionExtractor()

    def extract_from_file(self, file_path: str) -> List[Dict[str, Any]]:
        """
        Extract transactions from an Excel file on disk.

        Args:
            file_path: Path to the .xlsx file

        Returns:
            List of raw transaction dicts (same schema as CSV/PDF extractors)
        """
        path = Path(file_path)
        data = path.read_bytes()
        return self.extract_from_bytes(data, source_name=path.name)

    def extract_from_bytes(self, data: bytes, source_name: str = "upload.xlsx") -> List[Dict[str, Any]]:
        """
        Extract from raw bytes (e.g. an HTTP upload).

        Args:
            data: Raw file bytes
            source_name: Display name for logging

        Returns:
            List of raw transaction dicts
        """
        ext = Path(source_name).suffix.lower()

        if ext == ".xls":
            try:
                wb = xlrd.open_workbook(file_contents=data)
            except Exception as e:
                raise ValueError(f"Cannot open Excel file '{source_name}': {e}") from e
            ws = _best_xls_sheet(wb)
            rows = _xls_sheet_to_rows(ws, wb.datemode)
            logger.info(f"{source_name}: using sheet '{ws.name}' ({len(rows)} rows)")
            if rows:
                logger.info(f"{source_name}: raw header rows → {rows[:3]}")
        else:
            try:
                wb = openpyxl.load_workbook(BytesIO(data), data_only=True, read_only=True)
            except Exception as e:
                raise ValueError(f"Cannot open Excel file '{source_name}': {e}") from e
            ws = _best_sheet(wb)
            rows = _sheet_to_rows(ws)
            logger.info(f"{source_name}: using sheet '{ws.title}' ({len(rows)} rows)")

        if not rows:
            return []

        # Delegate to the CSV extractor's core logic by reconstructing its
        # row-based parse path directly (avoids CSV serialisation round-trip)
        return self._extract_from_rows(rows, source_name)

    def _extract_from_rows(
        self,
        rows: List[List[str]],
        source_name: str
    ) -> List[Dict[str, Any]]:
        """Parse a list-of-string-rows using the same column-detection logic."""
        header_row, header_idx = _find_header_in_rows(rows)
        if header_row is None:
            logger.warning(f"{source_name}: could not detect header row")
            return []

        col = _map_columns(header_row)

        # If description column wasn't matched, pick the best unclaimed column:
        # prefer columns whose headers don't look like serial numbers, and that
        # have the most non-empty values in the data rows.
        if col["desc"] is None:
            claimed = {v for v in col.values() if v is not None}
            data_rows = rows[header_idx + 1:]
            best_col, best_fill = None, -1
            for i, header in enumerate(header_row):
                if i in claimed or not header.strip():
                    continue
                if header.strip().lower() in _SERIAL_HEADERS:
                    continue
                fill = sum(1 for r in data_rows if i < len(r) and r[i].strip())
                if fill > best_fill:
                    best_fill = fill
                    best_col = i
            if best_col is not None:
                logger.info(
                    f"{source_name}: desc column not matched; "
                    f"falling back to column {best_col} ('{header_row[best_col]}')"
                )
                col["desc"] = best_col

        logger.info(f"{source_name}: columns → {col}")

        transactions = []
        for row_num, row in enumerate(rows[header_idx + 1:], start=header_idx + 2):
            txn = self._csv_extractor._parse_row(row, col, row_num)
            if txn:
                transactions.append(txn)

        logger.info(f"{source_name}: extracted {len(transactions)} transactions")
        return transactions
