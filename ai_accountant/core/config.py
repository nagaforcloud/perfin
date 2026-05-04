"""
Configuration management for AI Accountant.

Centralizes all configuration settings including:
- LLM endpoint configuration
- File paths
- Processing parameters
- Category definitions
"""

import os
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict


@dataclass
class Config:
    """
    Central configuration for the AI Accountant system.
    
    All paths are relative to the project root directory.
    LLM settings are optimized for llama.cpp server on local machine.
    """
    
    # Project root directory
    project_root: Path = field(default_factory=lambda: Path(__file__).parent.parent)
    
    # === Directory Paths ===
    data_dir: Path = field(default=None)
    pdf_dir: Path = field(default=None)
    processed_dir: Path = field(default=None)
    reports_dir: Path = field(default=None)
    database_dir: Path = field(default=None)
    rules_dir: Path = field(default=None)
    
    # === Database ===
    database_path: Path = field(default=None)

    # === Rules ===
    # Settable override; if None the property falls back to rules_dir / merchant_rules.json
    _merchant_rules_path: Path = field(default=None, repr=False)
    
    # === LLM Configuration ===
    llm_endpoint: str = "http://localhost:8080/v1/chat/completions"
    llm_model: str = "local-model"
    llm_max_tokens: int = 4096
    llm_temperature: float = 0.0  # Deterministic output
    llm_timeout: int = 120  # seconds

    # === Security ===
    # If set, all API requests must include Authorization: Bearer <this key>
    # Leave empty (default) to skip auth for local dev
    api_key: str = field(default_factory=lambda: os.environ.get("PERFIN_API_KEY", ""))

    # === OCR ===
    # Enable Tesseract OCR fallback for scanned/image-based PDFs
    ocr_enabled: bool = True

    # === Processing Parameters ===
    # Number of transactions per LLM batch (stays within 4K token limit)
    llm_batch_size: int = 100
    
    # Confidence threshold for rule-based categorization
    rule_confidence_threshold: float = 0.9
    
    # === Category Definitions ===
    valid_categories: List[str] = field(default_factory=lambda: [
        "Income",
        "Food",
        "Groceries",
        "Transport",
        "Utilities",
        "Shopping",
        "Rent",
        "Insurance",
        "Subscription",
        "Investment",
        "Transfer",
        "Medical",
        "Entertainment",
        "Travel",
        "Education",
        "Professional Services",
        "Home Maintenance",
        "Personal Care",
        "Gifts & Donations",
        "Other",
        "Needs Review"
    ])
    
    # Income subcategories
    income_categories: List[str] = field(default_factory=lambda: [
        "Salary",
        "Freelance",
        "Investment Returns",
        "Refunds",
        "Other Income"
    ])
    
    # === Anomaly Detection Thresholds ===
    # Transactions above this amount are flagged for review (in base currency)
    large_transaction_threshold: float = 50000.0
    
    # Standard deviations for statistical anomaly detection
    anomaly_std_threshold: float = 3.0
    
    # === Recurring Payment Detection ===
    # Minimum occurrences to consider something recurring
    recurring_min_occurrences: int = 2
    
    # Tolerance for amount matching (percentage)
    recurring_amount_tolerance: float = 0.05  # 5%
    
    # === Excel Export ===
    excel_default_filename: str = "financial_report.xlsx"
    
    def __post_init__(self):
        """Initialize paths after dataclass creation."""
        self._initialize_paths()
    
    def _initialize_paths(self):
        """Set up all directory paths relative to project root."""
        self.data_dir = self.project_root / "data"
        self.pdf_dir = self.data_dir / "pdf"
        self.processed_dir = self.data_dir / "processed"
        self.reports_dir = self.data_dir / "reports"
        self.database_dir = self.project_root / "database"
        self.rules_dir = self.project_root / "rules"
        
        # Create directories if they don't exist
        for directory in [
            self.data_dir,
            self.pdf_dir,
            self.processed_dir,
            self.reports_dir,
            self.database_dir,
            self.rules_dir
        ]:
            directory.mkdir(parents=True, exist_ok=True)
        
        # Set database path
        self.database_path = self.database_dir / "ledger.db"
    
    @property
    def merchant_rules_path(self) -> Path:
        """Path to the merchant categorization rules file."""
        if self._merchant_rules_path is not None:
            return self._merchant_rules_path
        return self.rules_dir / "merchant_rules.json"

    @merchant_rules_path.setter
    def merchant_rules_path(self, value: Path) -> None:
        """Allow tests (and callers) to override the merchant rules path."""
        self._merchant_rules_path = value
    
    @property
    def llm_headers(self) -> Dict[str, str]:
        """HTTP headers for LLM API requests."""
        return {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    
    def get_llm_payload(self, messages: List[Dict]) -> Dict:
        """
        Construct the payload for LLM API requests.
        
        Args:
            messages: List of message dictionaries with 'role' and 'content'
        
        Returns:
            Dictionary containing the full request payload
        """
        return {
            "model": self.llm_model,
            "messages": messages,
            "max_tokens": min(2048, self.llm_max_tokens // 2),  # Reserve tokens for response
            "temperature": self.llm_temperature,
            "stream": False
        }
    
    def __repr__(self) -> str:
        """String representation of configuration."""
        return (
            f"Config(project_root={self.project_root}, "
            f"llm_endpoint={self.llm_endpoint}, "
            f"database_path={self.database_path})"
        )
