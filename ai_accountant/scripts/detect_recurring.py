"""
Recurring Payment Detection Module.

Identifies recurring transactions such as subscriptions, memberships,
and regular payments using pattern matching and heuristics.

Detection criteria:
- Same or similar description (normalized)
- Same or similar amount (within configurable tolerance)
- Regular interval (monthly, quarterly, yearly)
- Minimum occurrence count

IMPROVEMENTS APPLIED:
- Increased amount tolerance to 15% for variable bills
- Date offset tolerance of ±5 days
- Better merchant name normalization
- Handles minor price changes
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import defaultdict
import re

from core.config import Config
from core.ledger import Ledger

logger = logging.getLogger(__name__)


@dataclass
class RecurringPayment:
    """
    Represents a detected recurring payment.

    Attributes:
        description: Transaction description/merchant
        amount: Typical transaction amount
        frequency: Detected frequency (monthly, quarterly, yearly)
        occurrences: Number of times detected
        total_amount: Total amount paid across all occurrences
        first_date: Date of first occurrence
        last_date: Date of most recent occurrence
        transactions: List of transaction IDs
        category: Assigned category
        confidence: Detection confidence (0.0 to 1.0)
        amount_variance: Variance in amounts (for debugging)
    """
    description: str
    amount: float
    frequency: str
    occurrences: int
    total_amount: float
    first_date: str
    last_date: str
    transactions: List[int]
    category: str
    confidence: float = 0.0
    amount_variance: float = 0.0


class RecurringPaymentDetector:
    """
    Detects recurring payments from transaction history.

    The detector uses multiple signals:
    1. Description similarity (normalized and compared)
    2. Amount similarity (within configured tolerance)
    3. Date interval regularity (with ±5 day tolerance)
    4. Minimum occurrence threshold

    Common recurring payments detected:
    - Streaming subscriptions (Netflix, Spotify)
    - Software subscriptions (Adobe, Microsoft 365)
    - Insurance premiums
    - Loan payments
    - Rent
    - Investment SIPs
    - Utility bills (with variable amounts)
    """

    # Known subscription patterns
    SUBSCRIPTION_PATTERNS = [
        'netflix', 'spotify', 'amazon prime', 'disney', 'hulu',
        'apple music', 'youtube premium', 'hbo', 'adobe',
        'microsoft 365', 'office 365', 'icloud', 'dropbox',
        'slack', 'zoom', 'github', 'jetbrains'
    ]

    # Frequency detection thresholds (days) - with tolerance
    WEEKLY_MAX_DAYS = 10
    MONTHLY_MIN_DAYS = 23
    MONTHLY_MAX_DAYS = 38  # Extended for billing date flexibility
    QUARTERLY_MIN_DAYS = 75
    QUARTERLY_MAX_DAYS = 105
    YEARLY_MIN_DAYS = 330
    YEARLY_MAX_DAYS = 395

    # Date tolerance for recurring detection (±days)
    DATE_TOLERANCE_DAYS = 5

    def __init__(
        self,
        config: Optional[Config] = None,
        ledger: Optional[Ledger] = None
    ):
        """
        Initialize the recurring payment detector.

        Args:
            config: Configuration object
            ledger: Ledger instance for database queries
        """
        self.config = config or Config()
        # Ledger is created lazily via the property below so that callers
        # that only use utility methods (e.g. _normalize_merchant) don't
        # need a database to be present.
        self._ledger = ledger
        self._ledger_created = ledger is not None

        # Use config values with sensible defaults
        self.min_occurrences = getattr(
            self.config, 'recurring_min_occurrences', 2
        )
        # Increased tolerance for variable bills (utilities, etc.)
        self.amount_tolerance = getattr(
            self.config, 'recurring_amount_tolerance', 0.15
        )  # 15%

        self.detected_payments: List[RecurringPayment] = []

    @property
    def ledger(self) -> Ledger:
        """Lazy Ledger accessor — only initialises the database on first use."""
        if self._ledger is None:
            self._ledger = Ledger(self.config)
        return self._ledger

    @ledger.setter
    def ledger(self, value: Ledger) -> None:
        self._ledger = value

    def detect_all(self) -> List[RecurringPayment]:
        """
        Detect all recurring payments in the ledger.

        Returns:
            List of detected recurring payments
        """
        # Get all transactions
        transactions = self.ledger.get_all_transactions()

        if not transactions:
            logger.info("No transactions to analyze")
            return []

        # Group transactions by normalized description and similar amount
        groups = self._group_transactions(transactions)

        logger.info(f"Found {len(groups)} transaction groups to analyze")

        # Analyze each group for recurring patterns
        self.detected_payments = []

        for group_key, group_txns in groups.items():
            if len(group_txns) < self.min_occurrences:
                continue

            payment = self._analyze_group(group_txns)
            if payment:
                self.detected_payments.append(payment)

        # Sort by total amount (highest first)
        self.detected_payments.sort(key=lambda p: p.total_amount, reverse=True)

        logger.info(f"Detected {len(self.detected_payments)} recurring payments")

        return self.detected_payments

    def _normalize_merchant(self, description: str) -> str:
        """
        Normalize merchant name for grouping.
        
        Improvements:
        - Remove common suffixes and prefixes
        - Handle variations like "Netflix.com" vs "Netflix Payment"
        - Remove reference numbers
        
        Args:
            description: Raw description
            
        Returns:
            Normalized merchant name
        """
        if not description:
            return ""
        
        merchant = description.lower()
        
        # Remove common patterns that vary between transactions
        remove_patterns = [
            r'\s+payment\s*$',
            r'\s+transaction\s*$',
            r'\s+debit\s*$',
            r'\s+charge\s*$',
            r'\s+auto\s*$',
            r'\s+automatic\s*$',
            r'\s+recurring\s*$',
            r'\s+inst\s*$',
            r'\s+ref\s*\d*\s*$',
            r'\s+txn\s*\d*\s*$',
            r'\s*#\d+\s*$',
            r'\.com\s*$',
            r'\s+inc\s*$',
            r'\s+llc\s*$',
            r'\s+corp\s*$',
            r'\s+limited\s*$',
        ]
        
        for pattern in remove_patterns:
            merchant = re.sub(pattern, '', merchant)
        
        # Remove trailing numbers (reference numbers)
        merchant = re.sub(r'\d+$', '', merchant)
        
        # Remove extra whitespace
        merchant = ' '.join(merchant.split())
        
        # Remove trailing punctuation
        merchant = merchant.rstrip(' .-')
        
        return merchant.strip()

    def _group_transactions(
        self,
        transactions: List[Dict[str, Any]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Group transactions by normalized merchant and similar amount.
        
        Uses amount buckets to group transactions with small variations.
        
        Args:
            transactions: List of transactions
            
        Returns:
            Dictionary mapping group key to transactions
        """
        groups = defaultdict(list)

        for txn in transactions:
            # Only consider expenses (negative amounts)
            amount = txn.get('amount', 0)
            if amount >= 0:
                continue
            
            # Normalize merchant
            merchant = self._normalize_merchant(txn.get('description', ''))
            
            if not merchant:
                continue
            
            # Create amount bucket to group transactions with small variations.
            # Buckets must be wide enough that amounts within the configured
            # tolerance (e.g. 15-20%) still land in the same bucket.
            abs_amount = abs(amount)
            if abs_amount < 50:
                # For small amounts, use $5 buckets
                amount_bucket = round(abs_amount / 5) * 5
            elif abs_amount < 500:
                # For medium amounts, use $25 buckets
                amount_bucket = round(abs_amount / 25) * 25
            else:
                # For large amounts, use $100 buckets
                amount_bucket = round(abs_amount / 100) * 100
            
            # Group key: merchant + amount bucket
            group_key = f"{merchant}|{amount_bucket}"
            groups[group_key].append(txn)

        return dict(groups)

    def _analyze_group(
        self,
        transactions: List[Dict[str, Any]]
    ) -> Optional[RecurringPayment]:
        """
        Analyze a group of transactions for recurring pattern.

        Args:
            transactions: List of transactions in the group

        Returns:
            RecurringPayment if pattern detected, None otherwise
        """
        if len(transactions) < self.min_occurrences:
            return None

        # Sort by date
        sorted_txns = sorted(transactions, key=lambda t: t.get('date', ''))

        # Extract dates and amounts
        dates = [t.get('date', '') for t in sorted_txns]
        amounts = [t.get('amount', 0) for t in sorted_txns]
        txn_ids = [t.get('id') for t in sorted_txns]

        # Check amount consistency with tolerance
        avg_amount = sum(abs(a) for a in amounts) / len(amounts)
        amount_variance = self._calculate_variance(amounts, avg_amount)

        # Skip if amounts vary too much (beyond tolerance)
        if amount_variance > self.amount_tolerance:
            logger.debug(
                f"Skipped due to high variance: {amount_variance:.2f} > {self.amount_tolerance}"
            )
            return None

        # Detect frequency with date tolerance
        frequency = self._detect_frequency(dates)

        if not frequency or frequency == 'irregular':
            return None

        # Calculate confidence
        confidence = self._calculate_confidence(
            len(transactions),
            amount_variance,
            frequency
        )

        # Only include if confidence is reasonable
        if confidence < 0.4:
            return None

        # Determine category
        category = self._infer_category(
            sorted_txns[0].get('description', ''),
            avg_amount
        )

        # Get original description (first occurrence)
        original_description = sorted_txns[0].get('description', '')

        return RecurringPayment(
            description=original_description,
            amount=avg_amount,
            frequency=frequency,
            occurrences=len(transactions),
            total_amount=avg_amount * len(transactions),
            first_date=dates[0],
            last_date=dates[-1],
            transactions=txn_ids,
            category=category,
            confidence=round(confidence, 2),
            amount_variance=round(amount_variance, 4)
        )

    def _calculate_variance(self, amounts: List[float], avg: float) -> float:
        """
        Calculate normalized variance (coefficient of variation) of amounts.

        Args:
            amounts: List of amounts
            avg: Pre-calculated average

        Returns:
            Normalized variance (0.0 to 1.0+)
        """
        if len(amounts) < 2 or avg == 0:
            return 0.0

        abs_amounts = [abs(a) for a in amounts]
        
        # Calculate standard deviation
        variance = sum((a - avg) ** 2 for a in abs_amounts) / len(abs_amounts)
        std_dev = variance ** 0.5

        # Coefficient of variation (normalized by mean)
        return std_dev / avg

    def _detect_frequency(self, dates: List[str]) -> Optional[str]:
        """
        Detect the frequency of transactions based on dates.
        
        Uses average interval with tolerance for billing date variations.

        Args:
            dates: List of date strings (YYYY-MM-DD)

        Returns:
            Frequency string or None
        """
        if len(dates) < 2:
            return None

        # Parse dates
        parsed_dates = []
        for date_str in dates:
            try:
                parsed_dates.append(datetime.strptime(date_str, '%Y-%m-%d'))
            except ValueError:
                logger.warning(f"Invalid date format: {date_str}")
                continue

        if len(parsed_dates) < 2:
            return None

        # Calculate intervals
        intervals = []
        for i in range(1, len(parsed_dates)):
            delta = (parsed_dates[i] - parsed_dates[i-1]).days
            intervals.append(delta)

        if not intervals:
            return None

        avg_interval = sum(intervals) / len(intervals)
        
        # Check interval consistency (for regular payments)
        interval_variance = self._calculate_variance(intervals, avg_interval)
        
        # If intervals are very inconsistent, might not be truly recurring
        if interval_variance > 0.5:
            logger.debug(f"High interval variance: {interval_variance:.2f}")

        # Determine frequency with extended ranges for flexibility
        if self.WEEKLY_MAX_DAYS >= avg_interval:
            return 'weekly'
        elif self.MONTHLY_MIN_DAYS <= avg_interval <= self.MONTHLY_MAX_DAYS:
            return 'monthly'
        elif self.QUARTERLY_MIN_DAYS <= avg_interval <= self.QUARTERLY_MAX_DAYS:
            return 'quarterly'
        elif self.YEARLY_MIN_DAYS <= avg_interval <= self.YEARLY_MAX_DAYS:
            return 'yearly'
        else:
            return 'irregular'

    def _calculate_confidence(
        self,
        occurrences: int,
        amount_variance: float,
        frequency: str
    ) -> float:
        """
        Calculate confidence score for the detection.

        Args:
            occurrences: Number of occurrences
            amount_variance: Amount variance (0.0 to 1.0+)
            frequency: Detected frequency

        Returns:
            Confidence score (0.0 to 1.0)
        """
        # Base confidence from occurrence count (max at 6 occurrences)
        occurrence_score = min(1.0, occurrences / 6)

        # Amount consistency score (inverse of variance)
        # Lower variance = higher confidence
        consistency_score = max(0, 1.0 - amount_variance)

        # Frequency score (monthly is most reliable for subscriptions)
        frequency_scores = {
            'monthly': 1.0,
            'quarterly': 0.85,
            'yearly': 0.75,
            'weekly': 0.6,
            'irregular': 0.2
        }
        frequency_score = frequency_scores.get(frequency, 0.3)

        # Weighted average
        confidence = (
            occurrence_score * 0.4 +      # 40% weight on occurrences
            consistency_score * 0.35 +    # 35% weight on amount consistency
            frequency_score * 0.25        # 25% weight on frequency
        )

        return confidence

    def _infer_category(self, description: str, amount: float) -> str:
        """
        Infer category from description and amount.

        Args:
            description: Transaction description
            amount: Transaction amount

        Returns:
            Category name
        """
        desc_lower = description.lower()

        # Check for known subscription patterns
        for pattern in self.SUBSCRIPTION_PATTERNS:
            if pattern in desc_lower:
                return 'Subscription'

        # Check for other common categories
        if any(kw in desc_lower for kw in ['rent', 'lease', 'mortgage']):
            return 'Rent'
        elif any(kw in desc_lower for kw in ['insurance', 'premium']):
            return 'Insurance'
        elif any(kw in desc_lower for kw in ['sip', 'mutual fund', '401k', 'ira']):
            return 'Investment'
        elif any(kw in desc_lower for kw in ['loan', 'emi', 'finance']):
            return 'Loan Payment'
        elif any(kw in desc_lower for kw in ['electric', 'water', 'gas', 'utility', 'power']):
            return 'Utilities'
        elif any(kw in desc_lower for kw in ['internet', 'cable', 'phone', 'mobile']):
            return 'Utilities'
        elif any(kw in desc_lower for kw in ['gym', 'fitness', 'membership']):
            return 'Personal Care'

        return 'Subscription'  # Default for recurring payments

    def get_monthly_recurring_total(self) -> float:
        """
        Calculate total monthly recurring expenses.

        Returns:
            Total monthly recurring amount
        """
        monthly_total = 0.0

        for payment in self.detected_payments:
            abs_amount = abs(payment.amount)
            
            if payment.frequency == 'monthly':
                monthly_total += abs_amount
            elif payment.frequency == 'quarterly':
                monthly_total += abs_amount / 3
            elif payment.frequency == 'yearly':
                monthly_total += abs_amount / 12
            elif payment.frequency == 'weekly':
                monthly_total += abs_amount * 4.33  # Average weeks per month

        return round(monthly_total, 2)

    def get_annual_recurring_total(self) -> float:
        """
        Calculate total annual recurring expenses.

        Returns:
            Total annual recurring amount
        """
        return round(self.get_monthly_recurring_total() * 12, 2)

    def get_stats(self) -> Dict[str, Any]:
        """Get detection statistics."""
        return {
            'total_recurring_payments': len(self.detected_payments),
            'monthly_recurring_total': self.get_monthly_recurring_total(),
            'annual_recurring_total': self.get_annual_recurring_total(),
            'by_frequency': self._count_by_frequency(),
            'average_confidence': (
                sum(p.confidence for p in self.detected_payments) / 
                len(self.detected_payments)
            ) if self.detected_payments else 0
        }

    def _count_by_frequency(self) -> Dict[str, int]:
        """Count recurring payments by frequency."""
        counts = defaultdict(int)
        for payment in self.detected_payments:
            counts[payment.frequency] += 1
        return dict(counts)


def detect_recurring_payments(
    config: Optional[Config] = None,
    ledger: Optional[Ledger] = None
) -> List[RecurringPayment]:
    """
    Convenience function to detect recurring payments.

    Args:
        config: Configuration object
        ledger: Ledger instance

    Returns:
        List of detected recurring payments
    """
    detector = RecurringPaymentDetector(config=config, ledger=ledger)
    return detector.detect_all()
