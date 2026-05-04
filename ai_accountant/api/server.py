"""
AI Accountant — Tornado REST API server.

Endpoints
─────────
GET    /api/accounts                  list accounts
POST   /api/accounts                  create account
PATCH  /api/accounts/<name>           update account metadata

GET    /api/transactions              list (filterable: account, category,
                                       start_date, end_date, search, limit)
PATCH  /api/transactions/<id>         update category / description
DELETE /api/transactions/<id>         delete a transaction

POST   /api/upload                    upload statement (PDF / CSV / XLSX)

GET    /api/analytics/summary         overall income/expense summary
GET    /api/analytics/monthly         monthly breakdown
GET    /api/analytics/categories      category breakdown
GET    /api/analytics/merchants       top merchants
GET    /api/analytics/health          financial health score

GET    /api/anomalies                 detected anomalies
GET    /api/recurring                 recurring payments

POST   /api/categorize                trigger rule+LLM categorisation

GET    /api/categories                list all valid categories
"""

from __future__ import annotations

import json
import logging
import os
import sys
import tempfile
import traceback
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import parse_qs, urlparse

import tornado.httpserver
import tornado.ioloop
import tornado.web

# ---------------------------------------------------------------------------
# Bootstrap sys.path so we can import from the project root
# ---------------------------------------------------------------------------
_HERE = Path(__file__).resolve().parent
_PROJECT = _HERE.parent
for _p in [str(_PROJECT), str(_PROJECT.parent)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from core.config import Config
from core.ledger import Ledger
from scripts.detect_anomalies import AnomalyDetector
from scripts.detect_recurring import RecurringPaymentDetector
from scripts.financial_summary import FinancialAnalyzer
from scripts.normalize_transactions import TransactionNormalizer
from scripts.categorize_rules import RuleCategorizer

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _json_default(obj: Any) -> Any:
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def _dumps(obj: Any) -> str:
    return json.dumps(obj, default=_json_default)


# ---------------------------------------------------------------------------
# Base handler
# ---------------------------------------------------------------------------

class BaseHandler(tornado.web.RequestHandler):

    def initialize(self, config: Config, ledger: Ledger) -> None:
        self.cfg = config
        self.ledger = ledger

    def set_default_headers(self) -> None:
        self.set_header("Content-Type", "application/json; charset=utf-8")
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS")
        self.set_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def options(self, *args, **kwargs) -> None:
        self.set_status(204)

    def prepare(self) -> None:
        """Auth check before every request."""
        # Skip auth if no API key configured (local dev mode)
        if not self.cfg.api_key:
            return
        # Skip auth for OPTIONS (CORS preflight)
        if self.request.method == "OPTIONS":
            return
        auth = self.request.headers.get("Authorization", "")
        expected = f"Bearer {self.cfg.api_key}"
        if auth != expected:
            self.set_status(401)
            self.write(_dumps({"error": "Unauthorized — valid API key required"}))
            self.finish()

    # --- response helpers ---

    def ok(self, data: Any) -> None:
        """Write data directly as JSON — no envelope."""
        self.write(_dumps(data))

    def err(self, msg: str, code: int = 400, extra: Optional[Dict] = None) -> None:
        self.set_status(code)
        payload: Dict = {"error": msg}
        if extra:
            payload.update(extra)
        self.write(_dumps(payload))

    def get_json(self) -> Dict:
        try:
            return json.loads(self.request.body or b"{}")
        except Exception:
            return {}

    def qparam(self, name: str, default: Optional[str] = None) -> Optional[str]:
        v = self.get_argument(name, default)
        return v if v else default


# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------

class AccountsHandler(BaseHandler):

    def get(self) -> None:
        self.ok(self.ledger.get_accounts())

    def post(self) -> None:
        body = self.get_json()
        name = body.get("name", "").strip()
        if not name:
            return self.err("'name' is required")
        account = self.ledger.create_account(
            name=name,
            bank=body.get("bank", ""),
            account_type=body.get("account_type", "checking"),
            currency=body.get("currency", "INR"),
            color=body.get("color", "#6366f1"),
        )
        self.set_status(201)
        self.ok(account)


class AccountDetailHandler(BaseHandler):

    def patch(self, name: str) -> None:
        body = self.get_json()
        ok = self.ledger.update_account(name, **body)
        if ok:
            self.ok(self.ledger.get_account_by_name(name))
        else:
            self.err(f"Account '{name}' not found", 404)

    def delete(self, name: str) -> None:
        """Delete an account record. Transactions are retained but unlinked (account set to '')."""
        with self.ledger._get_connection() as conn:
            with self.ledger._transaction(conn):
                cur = conn.cursor()
                # Check exists
                cur.execute("SELECT id FROM accounts WHERE name = ?", (name,))
                if not cur.fetchone():
                    return self.err(f"Account '{name}' not found", 404)
                # Unlink transactions (keep them, just clear the account tag)
                cur.execute(
                    "UPDATE transactions SET account = '' WHERE account = ?", (name,)
                )
                cur.execute("DELETE FROM accounts WHERE name = ?", (name,))
        self.ok({"deleted": True, "name": name})


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------

class TransactionsHandler(BaseHandler):

    def get(self) -> None:
        account    = self.qparam("account")
        category   = self.qparam("category")
        start      = self.qparam("start_date")
        end        = self.qparam("end_date")
        search     = self.qparam("search")
        limit_str  = self.qparam("limit")
        offset_str = self.qparam("offset")
        limit      = int(limit_str)  if limit_str  and limit_str.isdigit()  else None
        offset     = int(offset_str) if offset_str and offset_str.isdigit() else 0

        txns = self.ledger.get_all_transactions(
            start_date=start,
            end_date=end,
            category=category,
        )

        if account:
            txns = [t for t in txns if t.get("account") == account]

        if search:
            s = search.lower()
            txns = [t for t in txns
                    if s in t.get("description", "").lower()
                    or s in t.get("category", "").lower()]

        total = len(txns)

        # Apply offset then limit for pagination
        if offset:
            txns = txns[offset:]
        if limit:
            txns = txns[:limit]

        self.set_header("X-Total-Count", str(total))
        self.ok({
            "transactions": txns,
            "total":        total,
            "offset":       offset,
            "limit":        limit,
        })


class TransactionDetailHandler(BaseHandler):

    def patch(self, txn_id: str) -> None:
        body = self.get_json()
        updated = False

        if "category" in body:
            cat = body["category"].strip()
            if cat not in self.cfg.valid_categories:
                return self.err(f"Invalid category '{cat}'")
            updated = self.ledger.update_category(int(txn_id), cat)

        if updated:
            self.ok({"updated": True, "id": int(txn_id)})
        else:
            self.err(f"Transaction {txn_id} not found", 404)

    def delete(self, txn_id: str) -> None:
        with self.ledger._get_connection() as conn:
            with self.ledger._transaction(conn):
                cur = conn.cursor()
                cur.execute("DELETE FROM transactions WHERE id = ?", (int(txn_id),))
                deleted = cur.rowcount > 0
        if deleted:
            self.ok({"deleted": True, "id": int(txn_id)})
        else:
            self.err(f"Transaction {txn_id} not found", 404)


# ---------------------------------------------------------------------------
# Upload
# ---------------------------------------------------------------------------

def _is_pdf_password_error(exc: Exception) -> bool:
    """Walk the exception chain looking for PDFPasswordIncorrect."""
    e: Optional[Exception] = exc
    while e is not None:
        if type(e).__name__ == "PDFPasswordIncorrect":
            return True
        # Also catch pdfplumber's wrapper when its message contains the hint
        if "password" in str(e).lower() and "incorrect" in str(e).lower():
            return True
        e = getattr(e, "__cause__", None) or getattr(e, "__context__", None)
    return False


# Maximum upload size: 50 MB
_MAX_UPLOAD_BYTES = 50 * 1024 * 1024

# Magic bytes for supported file types
_MAGIC_BYTES: Dict[str, bytes] = {
    ".pdf":  b"%PDF",
    ".xlsx": b"PK\x03\x04",   # ZIP-based Office Open XML
    ".xls":  b"\xd0\xcf\x11\xe0",  # Compound Document (legacy Office)
}


def _validate_file_type(body: bytes, ext: str) -> Optional[str]:
    """
    Validate that the file's magic bytes match its declared extension.

    Returns an error message string if invalid, or None if OK.
    .csv files are text-based and have no magic bytes — they are always accepted.
    """
    expected = _MAGIC_BYTES.get(ext)
    if expected is None:
        return None  # No magic-byte check for .csv
    if not body[:len(expected)] == expected:
        return (
            f"File content does not match the declared extension '{ext}'. "
            "Please upload a valid file."
        )
    return None


class UploadHandler(BaseHandler):

    def post(self) -> None:
        # Expect multipart/form-data with field "file" and "account"
        if not self.request.files:
            return self.err("No file uploaded")

        file_info = self.request.files.get("file", [None])[0]
        if not file_info:
            return self.err("Field 'file' missing")

        account_name = self.get_argument("account", "Default")
        password     = self.get_argument("password", None) or None   # PDF password
        filename = file_info["filename"]
        body = file_info["body"]
        ext = Path(filename).suffix.lower()

        # ---- File size guard ----
        if len(body) > _MAX_UPLOAD_BYTES:
            return self.err(
                f"File is too large ({len(body) // (1024*1024)} MB). "
                f"Maximum allowed size is {_MAX_UPLOAD_BYTES // (1024*1024)} MB."
            )

        # ---- Magic-byte validation ----
        if ext not in (".pdf", ".csv", ".xlsx", ".xls", ".qif", ".ofx", ".qfx"):
            return self.err(f"Unsupported file type '{ext}'. Supported: .pdf, .csv, .xlsx, .xls, .qif, .ofx, .qfx")
        magic_err = _validate_file_type(body, ext)
        if magic_err:
            return self.err(magic_err)

        # ---- Make sure account exists ----
        if not self.ledger.get_account_by_name(account_name):
            self.ledger.create_account(account_name)

        # ---- Extract raw transactions ----
        try:
            raw = self._extract(body, filename, ext, password=password)
        except Exception as e:
            if ext == ".pdf" and _is_pdf_password_error(e):
                return self.err(
                    "This PDF is password-protected. Please enter the PDF password and try again.",
                    extra={"password_required": True},
                )
            logger.error(traceback.format_exc())
            return self.err(f"Extraction failed: {e}")

        if not raw:
            return self.ok({"inserted": 0, "message": "No transactions found in file"})

        # ---- Normalise ----
        normalizer = TransactionNormalizer()
        normalised = normalizer.normalize_batch(raw, source_file=filename, account=account_name)

        # ---- Map to ledger schema ----
        ledger_txns = [
            {
                "date":        t["date"],
                "description": t["description"],
                "amount":      t["amount"],
                "account":     account_name,
                "category":    "Needs Review",
            }
            for t in normalised
        ]

        # ---- Insert ----
        inserted = self.ledger.insert_transactions(ledger_txns, source_file=filename)

        # ---- Auto-apply rules ----
        uncategorised = self.ledger.get_uncategorized_transactions()
        if uncategorised:
            rule_cat = RuleCategorizer(self.cfg)
            categorised, _ = rule_cat.categorize_batch(uncategorised)
            if categorised:
                updates = [(t["id"], t["category"]) for t in categorised]
                self.ledger.update_categories_batch(updates)

        self.set_status(201)
        ocr_used = any(t.get('ocr_used') for t in raw)
        self.ok({
            "inserted":    inserted,
            "extracted":   len(raw),
            "normalised":  len(normalised),
            "source_file": filename,
            "account":     account_name,
            "ocr_used":    ocr_used,
        })

    def _extract(self, body: bytes, filename: str, ext: str, password: Optional[str] = None):
        if ext == ".pdf":
            from scripts.extract_pdf import PDFTransactionExtractor
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
                f.write(body)
                tmp = f.name
            try:
                return PDFTransactionExtractor().extract_from_file(tmp, password=password)
            finally:
                os.unlink(tmp)

        elif ext == ".csv":
            from scripts.extract_csv import CSVTransactionExtractor
            return CSVTransactionExtractor().extract_from_bytes(body, source_name=filename)

        elif ext in (".xlsx", ".xls"):
            from scripts.extract_excel import ExcelTransactionExtractor
            return ExcelTransactionExtractor().extract_from_bytes(body, source_name=filename)

        elif ext == ".qif":
            from scripts.extract_qif import extract_from_bytes as extract_qif
            return extract_qif(body, source_name=filename)

        elif ext in (".ofx", ".qfx"):
            from scripts.extract_ofx import extract_from_bytes as extract_ofx
            return extract_ofx(body, source_name=filename)

        else:
            raise ValueError(f"Unsupported file type: {ext}")


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

class SummaryHandler(BaseHandler):

    def get(self) -> None:
        account = self.qparam("account")
        start   = self.qparam("start_date")
        end     = self.qparam("end_date")

        txns = self.ledger.get_all_transactions(start_date=start, end_date=end)
        if account:
            txns = [t for t in txns if t.get("account") == account]

        total_income   = sum(t["amount"] for t in txns if t["amount"] > 0)
        total_expenses = sum(abs(t["amount"]) for t in txns if t["amount"] < 0)
        net            = total_income - total_expenses
        savings_rate   = (net / total_income * 100) if total_income > 0 else 0.0

        self.ok({
            "total_income":    round(total_income, 2),
            "total_expenses":  round(total_expenses, 2),
            "net_savings":     round(net, 2),
            "savings_rate":    round(savings_rate, 2),
            "transaction_count": len(txns),
        })


class MonthlyHandler(BaseHandler):

    def get(self) -> None:
        account = self.qparam("account")
        start   = self.qparam("start_date")
        end     = self.qparam("end_date")

        txns = self.ledger.get_all_transactions(start_date=start, end_date=end)
        if account:
            txns = [t for t in txns if t.get("account") == account]

        months: Dict[str, Dict] = {}
        for t in txns:
            date = t.get("date", "")
            if not date or len(date) < 7:
                continue
            m = date[:7]
            if m not in months:
                months[m] = {"month": m, "income": 0.0, "expenses": 0.0, "net": 0.0, "count": 0}
            months[m]["count"] += 1
            amt = t["amount"]
            months[m]["net"] += amt
            if amt > 0:
                months[m]["income"] += amt
            else:
                months[m]["expenses"] += abs(amt)

        result = []
        for m in sorted(months):
            d = months[m]
            result.append({
                "month":    m,
                "income":   round(d["income"], 2),
                "expenses": round(d["expenses"], 2),
                "net":      round(d["net"], 2),
                "count":    d["count"],
            })

        self.ok(result)


class CategoriesHandler(BaseHandler):

    def get(self) -> None:
        account = self.qparam("account")
        start   = self.qparam("start_date")
        end     = self.qparam("end_date")

        rows = self.ledger.get_category_summary(start_date=start, end_date=end)
        if account:
            txns = self.ledger.get_all_transactions(start_date=start, end_date=end)
            txns = [t for t in txns if t.get("account") == account]
            # Re-aggregate per-account
            agg: Dict[str, Dict] = {}
            for t in txns:
                cat = t.get("category", "Needs Review")
                if cat not in agg:
                    agg[cat] = {"category": cat, "count": 0,
                                "total_amount": 0.0, "total_expenses": 0.0}
                agg[cat]["count"] += 1
                agg[cat]["total_amount"] += t["amount"]
                if t["amount"] < 0:
                    agg[cat]["total_expenses"] += abs(t["amount"])
            rows = sorted(agg.values(), key=lambda x: x["total_expenses"], reverse=True)
        self.ok(rows)


class MerchantsHandler(BaseHandler):

    def get(self) -> None:
        account = self.qparam("account")
        start   = self.qparam("start_date")
        end     = self.qparam("end_date")
        top_n   = int(self.qparam("top", "10"))

        txns = self.ledger.get_all_transactions(start_date=start, end_date=end)
        if account:
            txns = [t for t in txns if t.get("account") == account]

        merchants: Dict[str, Dict] = {}
        for t in txns:
            if t["amount"] >= 0:
                continue
            m = t.get("description", "").lower().strip()
            if m not in merchants:
                merchants[m] = {"merchant": m, "count": 0, "total": 0.0}
            merchants[m]["count"] += 1
            merchants[m]["total"] += abs(t["amount"])

        result = sorted(merchants.values(), key=lambda x: x["total"], reverse=True)[:top_n]
        for r in result:
            r["total"] = round(r["total"], 2)
            r["average"] = round(r["total"] / r["count"], 2) if r["count"] else 0
        self.ok(result)


class HealthHandler(BaseHandler):

    def get(self) -> None:
        analyzer = FinancialAnalyzer(config=self.cfg, ledger=self.ledger)
        self.ok(analyzer.get_financial_health_score())


# ---------------------------------------------------------------------------
# Detection endpoints
# ---------------------------------------------------------------------------

class AnomaliesHandler(BaseHandler):

    def get(self) -> None:
        detector = AnomalyDetector(config=self.cfg, ledger=self.ledger)
        anomalies = detector.detect_all()
        self.ok([
            {
                "transaction_id": a.transaction_id,
                "type":           a.anomaly_type,
                "severity":       a.severity,
                "reason":         a.reason,
                "suggested_action": a.suggested_action,
                "transaction":    a.transaction,
                "detected_at":    a.detected_at,
            }
            for a in anomalies
        ])


class RecurringHandler(BaseHandler):

    def get(self) -> None:
        detector = RecurringPaymentDetector(config=self.cfg, ledger=self.ledger)
        patterns = detector.detect_all()
        self.ok([
            {
                "merchant":     p.merchant,
                "amount":       p.amount,
                "frequency":    p.frequency,
                "confidence":   p.confidence,
                "next_expected": p.next_expected,
                "occurrences":  p.occurrences,
            }
            for p in patterns
        ])


# ---------------------------------------------------------------------------
# Categorise
# ---------------------------------------------------------------------------

class CategoriseHandler(BaseHandler):

    def post(self) -> None:
        use_llm = self.get_json().get("use_llm", False)
        uncategorised = self.ledger.get_uncategorized_transactions()
        if not uncategorised:
            return self.ok({"categorised": 0, "message": "Nothing to categorise"})

        rule_cat = RuleCategorizer(self.cfg)
        categorised, remaining = rule_cat.categorize_batch(uncategorised)
        if categorised:
            self.ledger.update_categories_batch([(t["id"], t["category"]) for t in categorised])

        llm_count = 0
        if use_llm and remaining:
            from scripts.categorize_llm import LLMCategorizer
            cat = LLMCategorizer(config=self.cfg, ledger=self.ledger)
            llm_count = cat.categorize_uncategorized()

        self.ok({
            "categorised_by_rules": len(categorised),
            "categorised_by_llm":   llm_count,
            "still_pending":        len(remaining) - llm_count,
        })


# ---------------------------------------------------------------------------
# Valid categories
# ---------------------------------------------------------------------------

class ValidCategoriesHandler(BaseHandler):

    def get(self) -> None:
        self.ok(self.cfg.valid_categories)


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

STATIC_DIR = Path(__file__).parent.parent / "web"


def make_app(config: Config, ledger: Ledger) -> tornado.web.Application:
    deps = dict(config=config, ledger=ledger)

    handlers = [
        # Accounts
        (r"/api/accounts",            AccountsHandler,        deps),
        (r"/api/accounts/(.+)",       AccountDetailHandler,   deps),

        # Transactions
        (r"/api/transactions",        TransactionsHandler,    deps),
        (r"/api/transactions/(\d+)",  TransactionDetailHandler, deps),

        # Upload
        (r"/api/upload",              UploadHandler,          deps),

        # Analytics
        (r"/api/analytics/summary",    SummaryHandler,    deps),
        (r"/api/analytics/monthly",    MonthlyHandler,    deps),
        (r"/api/analytics/categories", CategoriesHandler, deps),
        (r"/api/analytics/merchants",  MerchantsHandler,  deps),
        (r"/api/analytics/health",     HealthHandler,     deps),

        # Detection
        (r"/api/anomalies",  AnomaliesHandler,  deps),
        (r"/api/recurring",  RecurringHandler,  deps),

        # Categorise
        (r"/api/categorize", CategoriseHandler, deps),

        # Valid categories list
        (r"/api/categories", ValidCategoriesHandler, deps),

        # Serve React SPA — catch-all must be last
        (r"/(.*)", tornado.web.StaticFileHandler, {
            "path": str(STATIC_DIR),
            "default_filename": "index.html",
        }),
    ]

    return tornado.web.Application(
        handlers,
        debug=True,
        autoreload=False,
    )


def run(port: int = 8000, config: Optional[Config] = None) -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    )

    cfg = config or Config()
    db = Ledger(cfg)

    app = make_app(cfg, db)
    server = tornado.httpserver.HTTPServer(app, max_buffer_size=50 * 1024 * 1024)
    server.listen(port)

    logger.info(f"AI Accountant running on http://localhost:{port}")
    tornado.ioloop.IOLoop.current().start()


if __name__ == "__main__":
    run()
