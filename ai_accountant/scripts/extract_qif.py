"""
Quicken Interchange Format (QIF) parser.

QIF is a simple tag-based format used by Quicken, GNU Cash, and many banks.
Each transaction starts with a type marker and uses single-letter codes:

!Type:Bank
D01/15/2024
T-50.00
PGROCERY STORE
Mweekly groceries
LFood
^
"""

from __future__ import annotations

import re
from typing import List, Dict, Any


def extract_from_bytes(data: bytes, source_name: str = "upload.qif") -> List[Dict[str, Any]]:
    """Parse QIF file bytes into raw transaction dicts."""
    text = data.decode("utf-8", errors="replace")
    return _parse_qif(text)


def _parse_qif(text: str) -> List[Dict[str, Any]]:
    transactions: List[Dict[str, Any]] = []
    current: Dict[str, str] = {}

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue

        # End of transaction marker
        if line == "^":
            if current:
                transactions.append(_build_txn(current))
                current = {}
            continue

        # Section header (skip)
        if line.startswith("!"):
            continue

        # Tagged field: first char is the field code
        if len(line) >= 2 and line[0].isalpha():
            code = line[0].upper()
            value = line[1:].strip()
            current[code] = value

    # Don't forget last transaction if no trailing ^
    if current:
        transactions.append(_build_txn(current))

    return [t for t in transactions if t is not None]


def _build_txn(fields: Dict[str, str]) -> Dict[str, Any] | None:
    """Build a raw transaction dict from QIF field codes."""
    date = fields.get("D", "")
    amount_str = fields.get("T", "")
    payee = fields.get("P", "")
    memo = fields.get("M", "")
    category = fields.get("L", "")

    if not date:
        return None

    # Parse amount
    try:
        amount = float(amount_str.replace(",", ""))
    except (ValueError, TypeError):
        amount = 0.0

    # Build description from payee + memo
    description = payee
    if memo and memo != payee:
        description = f"{payee} - {memo}" if payee else memo
    if not description:
        description = "QIF Import"

    debit = ""
    credit = ""
    if amount < 0:
        debit = str(abs(amount))
    elif amount > 0:
        credit = str(amount)

    # Normalize date: QIF dates are often MM/DD/YYYY or MM/DD'YY
    date = _normalize_qif_date(date)

    return {
        "date": date,
        "description": description[:200],
        "debit": debit,
        "credit": credit,
        "balance": "",
    }


def _normalize_qif_date(raw: str) -> str:
    """Normalize QIF date to YYYY-MM-DD."""
    raw = raw.strip().replace("'", "/")

    # MM/DD/YYYY
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", raw)
    if m:
        return f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"

    # MM/DD/YY
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2})$", raw)
    if m:
        yy = int(m.group(3))
        year = 2000 + yy if yy < 70 else 1900 + yy
        return f"{year}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"

    # Already ISO
    if re.match(r"^\d{4}-\d{2}-\d{2}$", raw):
        return raw

    return raw


def extract_from_file(filepath: str) -> List[Dict[str, Any]]:
    """Parse a QIF file from disk."""
    with open(filepath, "rb") as f:
        return extract_from_bytes(f.read(), source_name=filepath)
