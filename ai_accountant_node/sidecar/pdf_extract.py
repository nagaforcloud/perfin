#!/usr/bin/env python3
"""
PDF sidecar for the Node backend.

Reads a PDF file path (argv[1]) and optional password (argv[2]),
invokes the existing PDFTransactionExtractor from the Python project,
and writes a JSON result to stdout.

Result shape:
  success:         {"ok": true, "transactions": [{date, description, debit, credit, balance}, ...]}
  password error:  {"ok": false, "error": "...", "password_required": true}
  other error:     {"ok": false, "error": "..."}
"""

from __future__ import annotations

import json
import sys
import traceback
from pathlib import Path


def _is_pw_error(exc: BaseException) -> bool:
    e: BaseException | None = exc
    while e is not None:
        if type(e).__name__ == "PDFPasswordIncorrect":
            return True
        if "password" in str(e).lower() and "incorrect" in str(e).lower():
            return True
        e = e.__cause__ or e.__context__
    return False


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "usage: pdf_extract.py <path> [password]"}))
        return 2

    pdf_path = sys.argv[1]
    password = sys.argv[2] if len(sys.argv) > 2 else None

    # The Node build expects PYTHONPATH to include the sibling Python project root.
    try:
        from scripts.extract_pdf import PDFTransactionExtractor  # type: ignore[import-not-found]
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"Cannot import PDFTransactionExtractor: {e}"}))
        return 3

    try:
        raw = PDFTransactionExtractor().extract_from_file(pdf_path, password=password)
    except Exception as e:
        if _is_pw_error(e):
            print(json.dumps({"ok": False, "error": "PDF is password-protected", "password_required": True}))
            return 0
        sys.stderr.write(traceback.format_exc())
        print(json.dumps({"ok": False, "error": str(e)}))
        return 0

    out = []
    for t in raw or []:
        # PDFTransactionExtractor yields RawTransaction dataclasses or dicts.
        def field(key: str):
            if isinstance(t, dict):
                return t.get(key)
            return getattr(t, key, None)

        out.append({
            "date": field("date"),
            "description": field("description"),
            "debit": field("debit"),
            "credit": field("credit"),
            "balance": field("balance"),
        })

    print(json.dumps({"ok": True, "transactions": out}))
    return 0


if __name__ == "__main__":
    sys.exit(main())

_ = Path  # silence unused import in minimal runs
