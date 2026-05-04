"""
OCR fallback for scanned/image-based PDFs.

When pdfplumber cannot extract text (scanned/image PDFs),
converts each page to an image and runs Tesseract OCR.
Then parses the OCR text for transaction patterns.

Requires: tesseract-ocr (system), pytesseract, pdf2image, Pillow
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


def extract_via_ocr(
    pdf_path: str,
    password: Optional[str] = None,
    dpi: int = 300,
) -> List[Dict[str, Any]]:
    """
    Extract transactions from a scanned PDF via OCR.

    Args:
        pdf_path: Path to the PDF file
        password: PDF password if encrypted
        dpi: Resolution for page rendering (higher = better OCR, slower)

    Returns:
        List of raw transaction dicts with keys: date, description, debit, credit, balance
    """
    try:
        from pdf2image import convert_from_path
        import pytesseract
    except ImportError as e:
        logger.warning("OCR dependencies missing: %s. Install pytesseract and pdf2image.", e)
        return []

    try:
        images = convert_from_path(
            pdf_path,
            dpi=dpi,
            userpw=password,
            poppler_path=None,  # rely on PATH
        )
    except Exception as e:
        logger.error("Failed to convert PDF to images: %s", e)
        return []

    if not images:
        logger.warning("No pages extracted from PDF for OCR")
        return []

    logger.info("OCR: processing %d page(s) at %d DPI", len(images), dpi)

    all_text = []
    for i, image in enumerate(images):
        try:
            text = pytesseract.image_to_string(image, config='--psm 6')
            all_text.append(text)
        except Exception as e:
            logger.warning("OCR failed on page %d: %s", i + 1, e)

    full_text = "\n".join(all_text)
    return _parse_ocr_text(full_text)


# ─── Transaction pattern matching ───────────────────────────────────────────

# Common bank statement line patterns:
#   DD/MM/YYYY  MERCHANT NAME          1,234.56 Cr
#   MM/DD/YYYY  DESCRIPTION             -500.00
#   2024-01-15  TRANSFER TO X           2500.00
#
# We try multiple patterns and collect all matches.

_LINE_PATTERNS = [
    # ISO date: 2024-01-15, then description, then amount
    re.compile(
        r'(\d{4}-\d{2}-\d{2})\s+(.+?)\s+([+-]?[\d,]+\.\d{2})',
        re.IGNORECASE,
    ),
    # DD/MM/YYYY or DD-MM-YYYY
    re.compile(
        r'(\d{2}[/-]\d{2}[/-]\d{4})\s+(.+?)\s+([+-]?[\d,]+\.\d{2})',
        re.IGNORECASE,
    ),
    # Amount first, then date, then description (some banks)
    re.compile(
        r'([+-]?[\d,]+\.\d{2})\s+(\d{2}[/-]\d{2}[/-]\d{4})\s+(.+)',
        re.IGNORECASE,
    ),
    # Date with month name: 15 Jan 2024
    re.compile(
        r'(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\s+(.+?)\s+([+-]?[\d,]+\.\d{2})',
        re.IGNORECASE,
    ),
    # Credit/Debit columns: description ... debit_amount credit_amount
    re.compile(
        r'(\d{2}[/-]\d{2}[/-]\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})',
        re.IGNORECASE,
    ),
]


def _parse_ocr_text(text: str) -> List[Dict[str, Any]]:
    """Parse OCR text into raw transaction dicts."""
    transactions: List[Dict[str, Any]] = []
    seen = set()  # deduplicate

    for pattern in _LINE_PATTERNS:
        for match in pattern.finditer(text):
            groups = match.groups()

            if len(groups) == 3:
                date_str, desc, amount_str = groups
                debit_str = ""
                credit_str = ""
                # Determine if debit or credit
                amount_val = _parse_amount(amount_str)
                if amount_val is None:
                    continue
                if amount_val < 0:
                    debit_str = str(abs(amount_val))
                else:
                    credit_str = str(amount_val)
            elif len(groups) == 4:
                date_str, desc, amt1, amt2 = groups
                amount_val = None
                debit_str = ""
                credit_str = ""
                # Try interpreting as debit/credit pair
                val1 = _parse_amount(amt1)
                val2 = _parse_amount(amt2)
                if val1 is not None and val2 is not None:
                    if val1 > 0 and val2 == 0:
                        debit_str = str(val1)
                    elif val2 > 0 and val1 == 0:
                        credit_str = str(val2)
                    elif val1 > 0:
                        debit_str = str(val1)
                    elif val2 > 0:
                        credit_str = str(val2)
                if not debit_str and not credit_str and val1 is not None:
                    debit_str = str(val1)
            else:
                continue

            desc = desc.strip().rstrip('.,;:')
            if not desc or len(desc) < 2:
                continue

            # Deduplicate by (date, description, amount_hint)
            key = (date_str, desc[:40], debit_str, credit_str)
            if key in seen:
                continue
            seen.add(key)

            transactions.append({
                "date": _normalize_date(date_str),
                "description": desc[:200],
                "debit": debit_str,
                "credit": credit_str,
                "balance": "",
            })

    logger.info("OCR extracted %d transaction candidates", len(transactions))
    return transactions


def _parse_amount(raw: str) -> Optional[float]:
    """Parse a string like '1,234.56' or '-500.00' into a float."""
    if not raw:
        return None
    raw = raw.strip().replace(",", "")
    # Handle parentheses notation: (500.00) = -500.00
    if raw.startswith("(") and raw.endswith(")"):
        raw = "-" + raw[1:-1]
    try:
        return float(raw)
    except ValueError:
        return None


def _normalize_date(raw: str) -> str:
    """Normalize various date formats to YYYY-MM-DD."""
    raw = raw.strip()

    # Already ISO format
    if re.match(r'^\d{4}-\d{2}-\d{2}$', raw):
        return raw

    # DD/MM/YYYY or DD-MM-YYYY
    m = re.match(r'^(\d{2})[/-](\d{2})[/-](\d{4})$', raw)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"

    # MM/DD/YYYY (ambiguous — we assume DD/MM for non-US banks)
    # Try DD/MM first; if day > 12, assume MM/DD
    m = re.match(r'^(\d{2})[/-](\d{2})[/-](\d{4})$', raw)
    if m:
        a, b, y = int(m.group(1)), int(m.group(2)), m.group(3)
        if a > 12:
            return f"{y}-{a:02d}-{b:02d}"
        return f"{y}-{b:02d}-{a:02d}"

    # "15 Jan 2024" or "Jan 15 2024"
    months = {
        "jan": "01", "feb": "02", "mar": "03", "apr": "04",
        "may": "05", "jun": "06", "jul": "07", "aug": "08",
        "sep": "09", "oct": "10", "nov": "11", "dec": "12",
    }
    m = re.match(r'(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})', raw)
    if m:
        mon = months.get(m.group(2).lower()[:3], "01")
        return f"{m.group(3)}-{mon}-{int(m.group(1)):02d}"

    m = re.match(r'([A-Za-z]{3,9})\s+(\d{1,2})\s+(\d{4})', raw)
    if m:
        mon = months.get(m.group(1).lower()[:3], "01")
        return f"{m.group(3)}-{mon}-{int(m.group(2)):02d}"

    # Return as-is for the normalizer to handle
    return raw
