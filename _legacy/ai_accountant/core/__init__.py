"""
Core modules for AI Accountant.

This package contains the fundamental components:
- Configuration management
- LLM client for local inference
- Ledger database operations
- Pipeline orchestration
"""

from .config import Config
from .llm_client import LLMClient
from .ledger import Ledger

__all__ = ["Config", "LLMClient", "Ledger"]
