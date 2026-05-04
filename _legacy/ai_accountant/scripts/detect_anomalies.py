"""
Anomaly Detection Module.

Identifies unusual or suspicious transactions that may require review.
Detection methods include:

1. Threshold-based: Transactions above a configured amount
2. Statistical: Transactions outside normal spending patterns
3. Frequency-based: Unusual merchant or transaction types
4. Category-based: Large transactions in typically small categories
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import defaultdict
import statistics

from core.config import Config
from core.ledger import Ledger

logger = logging.getLogger(__name__)


@dataclass
class Anomaly:
    """
    Represents a detected anomaly.
    
    Attributes:
        transaction_id: ID of the flagged transaction
        transaction: Full transaction data
        anomaly_type: Type of anomaly detected
        severity: Severity level (low, medium, high, critical)
        reason: Human-readable explanation
        suggested_action: Recommended action
    """
    transaction_id: int
    transaction: Dict[str, Any]
    anomaly_type: str
    severity: str
    reason: str
    suggested_action: str
    detected_at: str = field(default_factory=lambda: datetime.now().isoformat())


class AnomalyDetector:
    """
    Detects anomalous transactions requiring review.
    
    Detection strategies:
    1. Large Transaction Detection: Above configured threshold
    2. Statistical Outliers: Beyond N standard deviations
    3. Rare Merchant: First-time or infrequent merchants
    4. Category Anomaly: Unusual amount for category
    5. Time-based: Transactions at unusual times
    6. Velocity: Unusual number of transactions in short period
    """
    
    # Severity levels
    SEVERITY_LOW = 'low'
    SEVERITY_MEDIUM = 'medium'
    SEVERITY_HIGH = 'high'
    SEVERITY_CRITICAL = 'critical'
    
    # Anomaly types
    TYPE_LARGE_AMOUNT = 'large_amount'
    TYPE_STATISTICAL_OUTLIER = 'statistical_outlier'
    TYPE_RARE_MERCHANT = 'rare_merchant'
    TYPE_CATEGORY_ANOMALY = 'category_anomaly'
    TYPE_VELOCITY = 'velocity_spike'
    TYPE_NEW_MERCHANT = 'new_merchant'
    
    def __init__(
        self,
        config: Optional[Config] = None,
        ledger: Optional[Ledger] = None
    ):
        """
        Initialize the anomaly detector.
        
        Args:
            config: Configuration object
            ledger: Ledger instance
        """
        self.config = config or Config()
        # Ledger is created lazily so that callers using only utility methods
        # (e.g. _get_severity_for_amount) do not require a database.
        self._ledger = ledger

        # Thresholds
        self.large_amount_threshold = self.config.large_transaction_threshold
        self.std_threshold = self.config.anomaly_std_threshold

        self.anomalies: List[Anomaly] = []

    @property
    def ledger(self) -> Ledger:
        """Lazy Ledger accessor — only initialises the database on first use."""
        if self._ledger is None:
            self._ledger = Ledger(self.config)
        return self._ledger

    @ledger.setter
    def ledger(self, value: Ledger) -> None:
        self._ledger = value

    def detect_all(self) -> List[Anomaly]:
        """
        Run all anomaly detection methods.
        
        Returns:
            List of detected anomalies
        """
        self.anomalies = []
        
        # Get all transactions
        transactions = self.ledger.get_all_transactions()
        
        if not transactions:
            logger.info("No transactions to analyze")
            return []
        
        logger.info(f"Analyzing {len(transactions)} transactions for anomalies")
        
        # Run detection methods
        self._detect_large_amounts(transactions)
        self._detect_statistical_outliers(transactions)
        self._detect_rare_merchants(transactions)
        self._detect_category_anomalies(transactions)
        
        # Sort by severity
        severity_order = {
            self.SEVERITY_CRITICAL: 0,
            self.SEVERITY_HIGH: 1,
            self.SEVERITY_MEDIUM: 2,
            self.SEVERITY_LOW: 3
        }
        self.anomalies.sort(key=lambda a: severity_order.get(a.severity, 4))
        
        logger.info(f"Detected {len(self.anomalies)} anomalies")
        
        return self.anomalies
    
    def _get_severity_for_amount(self, amount: float, threshold: float) -> str:
        """
        Determine severity level based on amount relative to threshold.

        Args:
            amount: Absolute transaction amount
            threshold: Reference threshold (e.g. large_amount_threshold)

        Returns:
            Severity string (medium / high / critical)
        """
        if amount >= threshold * 5:
            return self.SEVERITY_CRITICAL
        elif amount >= threshold * 2:
            return self.SEVERITY_HIGH
        else:
            return self.SEVERITY_MEDIUM

    def _detect_large_amounts(self, transactions: List[Dict[str, Any]]):
        """
        Detect transactions above the large amount threshold.

        Args:
            transactions: List of transactions
        """
        for txn in transactions:
            amount = abs(txn.get('amount', 0))

            if amount >= self.large_amount_threshold:
                # Determine severity based on amount
                severity = self._get_severity_for_amount(amount, self.large_amount_threshold)
                
                self.anomalies.append(Anomaly(
                    transaction_id=txn.get('id'),
                    transaction=txn,
                    anomaly_type=self.TYPE_LARGE_AMOUNT,
                    severity=severity,
                    reason=f"Large transaction: ${amount:,.2f} exceeds threshold of ${self.large_amount_threshold:,.2f}",
                    suggested_action="Review transaction and verify it was authorized"
                ))
    
    def _detect_statistical_outliers(self, transactions: List[Dict[str, Any]]):
        """
        Detect transactions that are statistical outliers.
        
        Uses z-score to identify transactions beyond N standard deviations
        from the mean transaction amount.
        
        Args:
            transactions: List of transactions
        """
        # Get all debit amounts (expenses)
        amounts = [abs(t.get('amount', 0)) for t in transactions if t.get('amount', 0) < 0]
        
        if len(amounts) < 10:
            return  # Not enough data for statistical analysis
        
        mean = statistics.mean(amounts)
        std_dev = statistics.stdev(amounts)
        
        if std_dev == 0:
            return  # No variance
        
        for txn in transactions:
            amount = txn.get('amount', 0)
            if amount >= 0:  # Skip credits
                continue
            
            abs_amount = abs(amount)
            z_score = (abs_amount - mean) / std_dev
            
            if z_score > self.std_threshold:
                if z_score > self.std_threshold * 2:
                    severity = self.SEVERITY_HIGH
                else:
                    severity = self.SEVERITY_MEDIUM
                
                self.anomalies.append(Anomaly(
                    transaction_id=txn.get('id'),
                    transaction=txn,
                    anomaly_type=self.TYPE_STATISTICAL_OUTLIER,
                    severity=severity,
                    reason=f"Statistical outlier: ${abs_amount:,.2f} is {z_score:.1f} standard deviations from mean (${mean:,.2f})",
                    suggested_action="Verify this is a legitimate expense"
                ))
    
    def _detect_rare_merchants(self, transactions: List[Dict[str, Any]]):
        """
        Detect transactions from rare or new merchants.
        
        Args:
            transactions: List of transactions
        """
        # Count merchant occurrences
        merchant_counts = defaultdict(int)
        merchant_txns = defaultdict(list)
        
        for txn in transactions:
            merchant = self._normalize_merchant(txn.get('description', ''))
            merchant_counts[merchant] += 1
            merchant_txns[merchant].append(txn)
        
        # Find rare merchants (only 1-2 occurrences)
        for merchant, count in merchant_counts.items():
            if count <= 2:
                for txn in merchant_txns[merchant]:
                    amount = abs(txn.get('amount', 0))
                    
                    # Only flag if amount is significant
                    if amount < 100:  # Skip small amounts
                        continue
                    
                    if count == 1:
                        severity = self.SEVERITY_LOW
                        anomaly_type = self.TYPE_NEW_MERCHANT
                        reason = f"First transaction with merchant: {merchant}"
                    else:
                        severity = self.SEVERITY_LOW
                        anomaly_type = self.TYPE_RARE_MERCHANT
                        reason = f"Rare merchant ({count} transactions): {merchant}"
                    
                    self.anomalies.append(Anomaly(
                        transaction_id=txn.get('id'),
                        transaction=txn,
                        anomaly_type=anomaly_type,
                        severity=severity,
                        reason=reason,
                        suggested_action="Verify this merchant is legitimate"
                    ))
    
    def _detect_category_anomalies(self, transactions: List[Dict[str, Any]]):
        """
        Detect transactions that are unusual for their category.
        
        For example, a $5000 "Food" transaction would be anomalous.
        
        Args:
            transactions: List of transactions
        """
        # Group by category
        category_amounts = defaultdict(list)
        category_txns = defaultdict(list)
        
        for txn in transactions:
            category = txn.get('category', 'Needs Review')
            amount = abs(txn.get('amount', 0))
            
            category_amounts[category].append(amount)
            category_txns[category].append(txn)
        
        # Calculate category statistics
        category_stats = {}
        for category, amounts in category_amounts.items():
            if len(amounts) >= 3:
                category_stats[category] = {
                    'mean': statistics.mean(amounts),
                    'std': statistics.stdev(amounts) if len(amounts) > 1 else 0,
                    'max': max(amounts)
                }
        
        # Find anomalies
        for category, stats in category_stats.items():
            if stats['std'] == 0:
                continue
            
            for txn in category_txns[category]:
                amount = abs(txn.get('amount', 0))
                
                # Skip if this is the max (expected large transaction)
                if amount >= stats['max'] * 0.9:
                    continue
                
                z_score = (amount - stats['mean']) / stats['std']
                
                # Flag if significantly larger than category average
                if amount > stats['mean'] * 3 and z_score > 2:
                    self.anomalies.append(Anomaly(
                        transaction_id=txn.get('id'),
                        transaction=txn,
                        anomaly_type=self.TYPE_CATEGORY_ANOMALY,
                        severity=self.SEVERITY_MEDIUM,
                        reason=f"Unusual for {category}: ${amount:,.2f} vs category avg ${stats['mean']:,.2f}",
                        suggested_action="Verify category assignment is correct"
                    ))
    
    def _normalize_merchant(self, description: str) -> str:
        """
        Normalize merchant name from description.
        
        Args:
            description: Transaction description
        
        Returns:
            Normalized merchant name
        """
        # Convert to lowercase
        merchant = description.lower()
        
        # Remove common suffixes
        suffixes = [
            ' payment', ' transaction', ' debit', ' charge',
            ' auto', ' automatic', ' recurring'
        ]
        for suffix in suffixes:
            merchant = merchant.replace(suffix, '')
        
        # Remove extra whitespace
        merchant = ' '.join(merchant.split())
        
        return merchant.strip()
    
    def get_high_priority(self) -> List[Anomaly]:
        """
        Get high and critical priority anomalies.
        
        Returns:
            List of high-priority anomalies
        """
        return [
            a for a in self.anomalies
            if a.severity in [self.SEVERITY_HIGH, self.SEVERITY_CRITICAL]
        ]
    
    def get_by_type(self, anomaly_type: str) -> List[Anomaly]:
        """
        Get anomalies of a specific type.
        
        Args:
            anomaly_type: Type to filter by
        
        Returns:
            List of matching anomalies
        """
        return [a for a in self.anomalies if a.anomaly_type == anomaly_type]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get detection statistics."""
        return {
            'total_anomalies': len(self.anomalies),
            'by_severity': self._count_by_severity(),
            'by_type': self._count_by_type(),
            'high_priority_count': len(self.get_high_priority())
        }
    
    def _count_by_severity(self) -> Dict[str, int]:
        """Count anomalies by severity."""
        counts = defaultdict(int)
        for anomaly in self.anomalies:
            counts[anomaly.severity] += 1
        return dict(counts)
    
    def _count_by_type(self) -> Dict[str, int]:
        """Count anomalies by type."""
        counts = defaultdict(int)
        for anomaly in self.anomalies:
            counts[anomaly.anomaly_type] += 1
        return dict(counts)


def detect_anomalies(
    config: Optional[Config] = None,
    ledger: Optional[Ledger] = None
) -> List[Anomaly]:
    """
    Convenience function to detect anomalies.
    
    Args:
        config: Configuration object
        ledger: Ledger instance
    
    Returns:
        List of detected anomalies
    """
    detector = AnomalyDetector(config=config, ledger=ledger)
    return detector.detect_all()
