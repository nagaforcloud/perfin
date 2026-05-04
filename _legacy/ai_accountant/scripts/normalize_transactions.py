"""
Transaction Normalization Module.

Transforms raw extracted transactions into a standardized schema:
- date: ISO format (YYYY-MM-DD)
- description: Cleaned text
- amount: Signed float (negative=debit, positive=credit)
- account: Source account name
- source_file: Original PDF filename

This module ensures consistent data format for downstream processing.
"""

import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)


class TransactionNormalizer:
    """
    Normalizes raw transactions into a standard schema.
    
    The normalizer handles:
    - Date format standardization
    - Amount sign normalization (debit=negative, credit=positive)
    - Description cleaning
    - Account assignment
    - Duplicate detection
    """
    
    def __init__(self, default_account: str = "Primary"):
        """
        Initialize the normalizer.
        
        Args:
            default_account: Default account name if not specified
        """
        self.default_account = default_account
        self.normalization_stats = {
            'total_input': 0,
            'normalized': 0,
            'skipped': 0,
            'duplicates_removed': 0
        }
    
    def normalize_batch(
        self,
        transactions: List[Dict[str, Any]],
        source_file: Optional[str] = None,
        account: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Normalize a batch of transactions.
        
        Args:
            transactions: List of raw transaction dictionaries
            source_file: Name of the source PDF file
            account: Account name (uses default if not specified)
        
        Returns:
            List of normalized transaction dictionaries
        """
        self.normalization_stats['total_input'] = len(transactions)
        
        normalized = []
        seen_signatures = set()
        
        for txn in transactions:
            norm_txn = self.normalize_single(
                txn,
                source_file=source_file,
                account=account or self.default_account
            )
            
            if norm_txn:
                # Check for duplicates
                signature = self._get_signature(norm_txn)
                if signature not in seen_signatures:
                    seen_signatures.add(signature)
                    normalized.append(norm_txn)
                    self.normalization_stats['normalized'] += 1
                else:
                    self.normalization_stats['duplicates_removed'] += 1
                    logger.debug(f"Duplicate transaction removed: {norm_txn['description']}")
            else:
                self.normalization_stats['skipped'] += 1
        
        logger.info(
            f"Normalized {len(normalized)} transactions "
            f"({self.normalization_stats['duplicates_removed']} duplicates removed)"
        )
        
        return normalized
    
    def normalize_single(
        self,
        transaction: Dict[str, Any],
        source_file: Optional[str] = None,
        account: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Normalize a single transaction.
        
        Args:
            transaction: Raw transaction dictionary
            source_file: Name of the source PDF file
            account: Account name
        
        Returns:
            Normalized transaction dictionary or None if invalid
        """
        # Validate required fields
        if not transaction.get('date'):
            logger.warning("Transaction missing date, skipping")
            return None
        
        if not transaction.get('description'):
            logger.warning("Transaction missing description, skipping")
            return None
        
        # Normalize date (should already be in ISO format from extractor)
        date = self._normalize_date(transaction.get('date', ''))
        if not date:
            return None
        
        # Calculate signed amount
        amount = self._calculate_amount(
            transaction.get('debit'),
            transaction.get('credit')
        )
        
        # Clean description
        description = self._clean_description(
            transaction.get('description', '')
        )
        
        if not description:
            description = "Unknown Transaction"
        
        return {
            'date': date,
            'description': description,
            'amount': amount,
            'account': account or self.default_account,
            'source_file': source_file or 'unknown',
            'original_page': transaction.get('page'),
            'original_balance': transaction.get('balance')
        }
    
    def _normalize_date(self, date_str: str) -> Optional[str]:
        """
        Ensure date is in ISO format (YYYY-MM-DD).
        
        Args:
            date_str: Date string
        
        Returns:
            ISO format date string or None
        """
        if not date_str:
            return None
        
        date_str = str(date_str).strip()
        
        # Already in ISO format
        if len(date_str) == 10 and date_str[4] == '-' and date_str[7] == '-':
            try:
                datetime.strptime(date_str, '%Y-%m-%d')
                return date_str
            except ValueError:
                pass
        
        # Try common formats
        formats = [
            '%d/%m/%Y', '%m/%d/%Y', '%d-%m-%Y', '%m-%d-%Y',
            '%Y/%m/%d',
            '%d %b %Y', '%d %B %Y',
            '%d %b %y', '%d %B %y'
        ]
        
        for fmt in formats:
            try:
                dt = datetime.strptime(date_str, fmt)
                return dt.strftime('%Y-%m-%d')
            except ValueError:
                continue
        
        logger.warning(f"Could not normalize date: {date_str}")
        return None
    
    def _calculate_amount(
        self,
        debit: Optional[float],
        credit: Optional[float]
    ) -> float:
        """
        Calculate signed amount from debit/credit values.
        
        Convention:
        - Debits (money out) are negative
        - Credits (money in) are positive
        
        Args:
            debit: Debit amount (if any)
            credit: Credit amount (if any)
        
        Returns:
            Signed amount
        """
        # Handle both debit and credit present (shouldn't happen, but handle it)
        if debit is not None and credit is not None:
            # Use the non-zero value
            if debit != 0 and credit == 0:
                return -abs(debit)
            elif credit != 0 and debit == 0:
                return abs(credit)
            else:
                # Both non-zero — this likely indicates an extraction error.
                # We prefer the credit (positive) value but log clearly so it
                # can be investigated.
                logger.warning(
                    "Transaction has both non-zero debit (%.2f) and credit (%.2f). "
                    "Using credit value; debit is discarded. "
                    "This may indicate a PDF extraction error.",
                    debit,
                    credit,
                )
                return abs(credit)
        
        # Only debit present
        if debit is not None:
            return -abs(debit)
        
        # Only credit present
        if credit is not None:
            return abs(credit)
        
        # No amount information - return 0 (will be flagged for review)
        return 0.0
    
    def _clean_description(self, description: str) -> str:
        """
        Clean and standardize transaction description.
        
        Args:
            description: Raw description
        
        Returns:
            Cleaned description
        """
        if not description:
            return ''
        
        # Convert to string and strip whitespace
        description = str(description).strip()
        
        # Remove common artifacts
        artifacts = ['*', '|', '  ', '\t', '\n', '\r']
        for artifact in artifacts:
            description = description.replace(artifact, ' ')
        
        # Normalize whitespace
        description = ' '.join(description.split())
        
        # Remove trailing punctuation
        description = description.rstrip(' .-:;')
        
        # Truncate very long descriptions
        if len(description) > 200:
            description = description[:197] + '...'
        
        return description
    
    def _get_signature(self, transaction: Dict[str, Any]) -> str:
        """
        Generate a unique signature for duplicate detection.
        
        Args:
            transaction: Normalized transaction
        
        Returns:
            Signature string
        """
        # Use date, amount, and description (first 50 chars) for signature
        date = transaction.get('date', '')
        amount = transaction.get('amount', 0)
        desc = transaction.get('description', '')[:50]
        
        return f"{date}|{amount}|{desc}"
    
    def get_stats(self) -> Dict[str, int]:
        """Get normalization statistics."""
        return self.normalization_stats.copy()


def normalize_transactions(
    transactions: List[Dict[str, Any]],
    source_file: Optional[str] = None,
    account: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Convenience function to normalize transactions.
    
    Args:
        transactions: List of raw transaction dictionaries
        source_file: Name of the source PDF file
        account: Account name
    
    Returns:
        List of normalized transaction dictionaries
    """
    normalizer = TransactionNormalizer()
    return normalizer.normalize_batch(transactions, source_file, account)
