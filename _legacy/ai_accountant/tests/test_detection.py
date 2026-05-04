"""
Tests for recurring payment detection and anomaly detection.
"""

import pytest
from datetime import datetime, timedelta
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.detect_recurring import RecurringPaymentDetector, RecurringPayment
from scripts.detect_anomalies import AnomalyDetector


class TestRecurringPaymentDetector:
    """Test recurring payment detection."""

    def test_detects_monthly_recurring(self, ledger):
        """Test detection of monthly recurring payments."""
        # Insert 3 monthly Netflix payments
        transactions = [
            {'date': '2024-01-15', 'description': 'Netflix', 'amount': -15.99},
            {'date': '2024-02-15', 'description': 'Netflix', 'amount': -15.99},
            {'date': '2024-03-15', 'description': 'Netflix', 'amount': -15.99},
        ]
        ledger.insert_transactions(transactions)
        
        detector = RecurringPaymentDetector(ledger=ledger)
        recurring = detector.detect_all()
        
        assert len(recurring) == 1
        assert recurring[0].frequency == 'monthly'
        assert recurring[0].occurrences == 3

    def test_handles_amount_variance(self, ledger):
        """Test detection with variable amounts (utilities)."""
        # Insert utility bills with small variations
        transactions = [
            {'date': '2024-01-15', 'description': 'Electric Company', 'amount': -120.00},
            {'date': '2024-02-15', 'description': 'Electric Company', 'amount': -135.00},  # 12.5% variance
            {'date': '2024-03-15', 'description': 'Electric Company', 'amount': -125.00},
        ]
        ledger.insert_transactions(transactions)
        
        detector = RecurringPaymentDetector(
            ledger=ledger,
            config=type('obj', (object,), {
                'recurring_min_occurrences': 2,
                'recurring_amount_tolerance': 0.20  # 20% tolerance
            })()
        )
        recurring = detector.detect_all()
        
        # Should detect as recurring despite variance
        assert len(recurring) >= 1

    def test_normalizes_merchant_names(self):
        """Test merchant name normalization."""
        detector = RecurringPaymentDetector()
        
        assert detector._normalize_merchant("Netflix.com") == "netflix"
        assert detector._normalize_merchant("NETFLIX PAYMENT") == "netflix"
        assert detector._normalize_merchant("Netflix #12345") == "netflix"
        assert detector._normalize_merchant("Netflix Subscription") == "netflix subscription"

    def test_calculates_monthly_total(self, ledger):
        """Test monthly recurring total calculation."""
        transactions = [
            {'date': '2024-01-15', 'description': 'Netflix', 'amount': -15.99},
            {'date': '2024-02-15', 'description': 'Netflix', 'amount': -15.99},
            {'date': '2024-01-20', 'description': 'Spotify', 'amount': -9.99},
            {'date': '2024-02-20', 'description': 'Spotify', 'amount': -9.99},
        ]
        ledger.insert_transactions(transactions)
        
        detector = RecurringPaymentDetector(ledger=ledger)
        detector.detect_all()
        
        monthly_total = detector.get_monthly_recurring_total()
        assert monthly_total > 0

    def test_date_frequency_detection(self):
        """Test frequency detection from dates."""
        detector = RecurringPaymentDetector()
        
        # Monthly pattern
        dates = ['2024-01-15', '2024-02-15', '2024-03-15']
        assert detector._detect_frequency(dates) == 'monthly'
        
        # Weekly pattern
        dates = ['2024-01-01', '2024-01-08', '2024-01-15']
        assert detector._detect_frequency(dates) == 'weekly'

    def test_confidence_calculation(self):
        """Test confidence score calculation."""
        detector = RecurringPaymentDetector()
        
        # High confidence: many occurrences, low variance, monthly
        confidence = detector._calculate_confidence(
            occurrences=6,
            amount_variance=0.05,
            frequency='monthly'
        )
        assert confidence > 0.8
        
        # Low confidence: few occurrences, high variance
        confidence = detector._calculate_confidence(
            occurrences=2,
            amount_variance=0.3,
            frequency='irregular'
        )
        assert confidence < 0.5


class TestAnomalyDetector:
    """Test anomaly detection."""

    def test_detects_large_transactions(self, ledger):
        """Test detection of large transactions."""
        transactions = [
            {'date': '2024-01-15', 'description': 'Coffee', 'amount': -5.00},
            {'date': '2024-01-16', 'description': 'Large Purchase', 'amount': -10000.00},
        ]
        ledger.insert_transactions(transactions)
        
        detector = AnomalyDetector(
            ledger=ledger,
            config=type('obj', (object,), {
                'large_transaction_threshold': 5000.0,
                'anomaly_std_threshold': 3.0
            })()
        )
        
        anomalies = detector.detect_all()
        
        large_anomalies = [a for a in anomalies if a.anomaly_type == 'large_amount']
        assert len(large_anomalies) == 1

    def test_detects_statistical_outliers(self, ledger):
        """Test detection of statistical outliers."""
        # Create transactions with one clear outlier
        transactions = [
            {'date': f'2024-01-{i:02d}', 'description': 'Normal', 'amount': -50.00}
            for i in range(1, 20)
        ]
        transactions.append(
            {'date': '2024-01-20', 'description': 'Outlier', 'amount': -5000.00}
        )
        ledger.insert_transactions(transactions)
        
        detector = AnomalyDetector(ledger=ledger)
        anomalies = detector.detect_all()
        
        outlier_anomalies = [a for a in anomalies if a.anomaly_type == 'statistical_outlier']
        assert len(outlier_anomalies) >= 1

    def test_detects_new_merchants(self, ledger):
        """Test detection of new merchants."""
        transactions = [
            {'date': '2024-01-15', 'description': 'New Merchant XYZ', 'amount': -500.00},
        ]
        ledger.insert_transactions(transactions)
        
        detector = AnomalyDetector(ledger=ledger)
        anomalies = detector.detect_all()
        
        new_merchant_anomalies = [
            a for a in anomalies 
            if a.anomaly_type in ['new_merchant', 'rare_merchant']
        ]
        assert len(new_merchant_anomalies) >= 1

    def test_severity_levels(self):
        """Test severity level assignment."""
        detector = AnomalyDetector()
        
        # Critical: 5x threshold
        assert detector._get_severity_for_amount(250000, 50000) == 'critical'
        
        # High: 2x threshold
        assert detector._get_severity_for_amount(100000, 50000) == 'high'
        
        # Medium: above threshold
        assert detector._get_severity_for_amount(60000, 50000) == 'medium'

    def _get_severity_for_amount(self, amount, threshold):
        """Helper to get severity for amount."""
        if amount >= threshold * 5:
            return 'critical'
        elif amount >= threshold * 2:
            return 'high'
        else:
            return 'medium'


class TestMerchantNormalization:
    """Test merchant name normalization for grouping."""

    def test_removes_common_suffixes(self):
        """Test removal of common suffixes."""
        detector = RecurringPaymentDetector()
        
        assert detector._normalize_merchant("Netflix Payment") == "netflix"
        assert detector._normalize_merchant("Spotify Transaction") == "spotify"
        assert detector._normalize_merchant("Uber Debit") == "uber"

    def test_removes_reference_numbers(self):
        """Test removal of reference numbers."""
        detector = RecurringPaymentDetector()
        
        result = detector._normalize_merchant("Payment Ref 12345")
        assert "12345" not in result

    def test_handles_variations(self):
        """Test handling of merchant name variations."""
        detector = RecurringPaymentDetector()
        
        # These should all normalize similarly
        variations = [
            "Netflix.com",
            "NETFLIX PAYMENT",
            "Netflix #1234",
            "Netflix Subscription"
        ]
        
        normalized = [detector._normalize_merchant(v) for v in variations]
        # All should contain "netflix"
        assert all("netflix" in n for n in normalized)
