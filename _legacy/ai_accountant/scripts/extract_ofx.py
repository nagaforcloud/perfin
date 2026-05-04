"""
Open Financial Exchange (OFX/QFX) parser.

OFX is an SGML/XML-like format used by many banks and financial institutions.
Handles both OFX 1.x (SGML) and OFX 2.x (XML) variants.

Example:
<STMTTRN>
  <TRNTYPE>DEBIT
  <DTPOSTED>20240115000000
  <TRNAMT>-50.00
  <NAME>GROCERY STORE
  <MEMO>weekly groceries
</STMTTRN>
"""

from __future__ import annotations

import re
from typing import List, Dict, Any


def extract_from_bytes(data: bytes, source_name: str = "upload.ofx") -> List[Dict[str, Any]]:
    """Parse OFX/QFX file bytes into raw transaction dicts."""
    text = data.decode("utf-8", errors="replace")
    # Some OFX files use latin-1
    try:
        text = data.decode("latin-1")
    except UnicodeDecodeError:
        text = data.decode("utf-8", errors="replace")

    return _parse_ofx(text)


def _parse_ofx(text: str) -> List[Dict[str, Any]]:
    transactions: List[Dict[str, Any]] = []

    # Find all STMTTRN blocks (handle both <TAG>value and <TAG>value</TAG>)
    # Simple approach: split by <STMTTRN> and parse each

    # Normalize SGML-style tags (self-closing without </>)
    # OFX 1.x uses <TAG>value format
    blocks = re.split(r"<STMTTRN>", text, flags=re.IGNORECASE)

    for block in blocks[1:]:  # skip text before first STMTTRN
        # Trim at closing tag
        end = block.find("</STMTTRN>")
        if end >= 0:
            block = block[:end]

        txn = _parse_stmttrn(block)
        if txn:
            transactions.append(txn)

    return transactions


def _parse_stmttrn(block: str) -> Dict[str, Any] | None:
    """Parse a single STMTTRN block into a transaction dict."""

    def _tag(name: str) -> str:
        """Extract tag value. Handles both <NAME>value and <NAME>value</NAME>."""
        # Try with closing tag
        pattern = rf"<{name}>\s*(.+?)\s*</{name}>"
        m = re.search(pattern, block, re.IGNORECASE | re.DOTALL)
        if m:
            return m.group(1).strip()

        # Try SGML style: <NAME>value (till next < or end)
        pattern = rf"<{name}>\s*(.+?)(?=<|$)"
        m = re.search(pattern, block, re.IGNORECASE | re.DOTALL)
        if m:
            return m.group(1).strip()

        return ""

    date = _tag("DTPOSTED")
    amount_str = _tag("TRNAMT")
    name = _tag("NAME")
    memo = _tag("MEMO")
    trntype = _tag("TRNTYPE")
    checknum = _tag("CHECKNUM")
    fitid = _tag("FITID")

    # Normalize date: OFX uses YYYYMMDD or YYYYMMDDHHMMSS
    date = _normalize_ofx_date(date)

    # Parse amount
    try:
        amount = float(amount_str.replace(",", ""))
    except (ValueError, TypeError):
        amount = 0.0

    # Build description
    description = name
    if memo and memo != name:
        description = f"{name} - {memo}" if name else memo
    if checknum:
        description = f"#{checknum} {description}"
    if not description:
        description = f"OFX Import ({trntype})" if trntype else "OFX Import"

    debit = ""
    credit = ""
    if amount < 0:
        debit = str(abs(amount))
    elif amount > 0:
        credit = str(amount)
    else:
        # Use TRNTYPE as hint
        if trntype.upper() in ("DEBIT", "PAYMENT", "XFER", "ATM", "FEE", "CHECK"):
            debit = amount_str.replace(",", "").lstrip("-")
        elif trntype.upper() in ("CREDIT", "DEP", "DIRECTDEP", "DIV", "INT"):
            credit = amount_str.replace(",", "")

    return {
        "date": date,
        "description": description[:200],
        "debit": debit,
        "credit": credit,
        "balance": "",
    }


def _normalize_ofx_date(raw: str) -> str:
    """Normalize OFX date (YYYYMMDD or YYYYMMDDHHMMSS) to YYYY-MM-DD."""
    raw = raw.strip()
    if len(raw) >= 8:
        return f"{raw[:4]}-{raw[4:6]}-{raw[6:8]}"
    return raw


def extract_from_file(filepath: str) -> List[Dict[str, Any]]:
    """Parse an OFX/QFX file from disk."""
    with open(filepath, "rb") as f:
        return extract_from_bytes(f.read(), source_name=filepath)
