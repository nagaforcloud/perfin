"""
Financial Analytics Module.

Provides comprehensive financial analysis including:
- Income vs Expense summaries
- Category breakdowns
- Monthly/Yearly trends
- Merchant analysis
- Cash flow analysis
- Budget tracking
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
class FinancialSummary:
    """
    Comprehensive financial summary.
    
    Attributes:
        period_start: Start date of analysis period
        period_end: End date of analysis period
        total_income: Total income
        total_expenses: Total expenses
        net_savings: Net savings (income - expenses)
        savings_rate: Savings rate percentage
        transaction_count: Total transactions
        category_breakdown: Breakdown by category
        monthly_summary: Monthly breakdown
        top_merchants: Top spending merchants
    """
    period_start: str
    period_end: str
    total_income: float
    total_expenses: float
    net_savings: float
    savings_rate: float
    transaction_count: int
    category_breakdown: Dict[str, Dict[str, Any]]
    monthly_summary: List[Dict[str, Any]]
    top_merchants: List[Dict[str, Any]]
    recurring_monthly: float = 0.0


class FinancialAnalyzer:
    """
    Comprehensive financial analysis engine.
    
    Provides insights into:
    - Spending patterns
    - Income trends
    - Category distribution
    - Merchant analysis
    - Cash flow
    - Financial health metrics
    """
    
    def __init__(
        self,
        config: Optional[Config] = None,
        ledger: Optional[Ledger] = None
    ):
        """
        Initialize the financial analyzer.
        
        Args:
            config: Configuration object
            ledger: Ledger instance
        """
        self.config = config or Config()
        self.ledger = ledger or Ledger(self.config)
    
    def generate_summary(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> FinancialSummary:
        """
        Generate comprehensive financial summary.
        
        Args:
            start_date: Start of analysis period (YYYY-MM-DD)
            end_date: End of analysis period (YYYY-MM-DD)
        
        Returns:
            FinancialSummary object
        """
        # Get transactions
        transactions = self.ledger.get_all_transactions(
            start_date=start_date,
            end_date=end_date
        )
        
        if not transactions:
            return self._empty_summary(start_date, end_date)
        
        # Calculate date range
        dates = [t.get('date', '') for t in transactions if t.get('date')]
        period_start = min(dates) if dates else start_date or ''
        period_end = max(dates) if dates else end_date or ''
        
        # Calculate totals
        total_income = sum(t.get('amount', 0) for t in transactions if t.get('amount', 0) > 0)
        total_expenses = sum(abs(t.get('amount', 0)) for t in transactions if t.get('amount', 0) < 0)
        net_savings = total_income - total_expenses
        
        # Calculate savings rate
        savings_rate = (net_savings / total_income * 100) if total_income > 0 else 0.0
        
        # Get category breakdown
        category_breakdown = self._analyze_categories(transactions)
        
        # Get monthly summary
        monthly_summary = self._analyze_monthly(transactions)
        
        # Get top merchants
        top_merchants = self._analyze_merchants(transactions)
        
        return FinancialSummary(
            period_start=period_start,
            period_end=period_end,
            total_income=round(total_income, 2),
            total_expenses=round(total_expenses, 2),
            net_savings=round(net_savings, 2),
            savings_rate=round(savings_rate, 2),
            transaction_count=len(transactions),
            category_breakdown=category_breakdown,
            monthly_summary=monthly_summary,
            top_merchants=top_merchants
        )
    
    def _empty_summary(self, start_date: Optional[str], end_date: Optional[str]) -> FinancialSummary:
        """Create an empty summary when no data exists."""
        return FinancialSummary(
            period_start=start_date or '',
            period_end=end_date or '',
            total_income=0.0,
            total_expenses=0.0,
            net_savings=0.0,
            savings_rate=0.0,
            transaction_count=0,
            category_breakdown={},
            monthly_summary=[],
            top_merchants=[]
        )
    
    def _analyze_categories(
        self,
        transactions: List[Dict[str, Any]]
    ) -> Dict[str, Dict[str, Any]]:
        """
        Analyze transactions by category.
        
        Args:
            transactions: List of transactions
        
        Returns:
            Dictionary with category statistics
        """
        categories = defaultdict(lambda: {
            'count': 0,
            'total': 0.0,
            'average': 0.0,
            'transactions': []
        })
        
        for txn in transactions:
            category = txn.get('category', 'Needs Review')
            amount = txn.get('amount', 0)
            
            categories[category]['count'] += 1
            categories[category]['total'] += amount
            categories[category]['transactions'].append(txn)
        
        # Calculate averages and clean up
        result = {}
        for category, data in categories.items():
            result[category] = {
                'count': data['count'],
                'total': round(data['total'], 2),
                'average': round(data['total'] / data['count'], 2) if data['count'] > 0 else 0,
                'percentage': 0.0  # Will calculate below
            }
        
        # Calculate percentages
        total_expenses = sum(
            abs(data['total']) for data in result.values() if data['total'] < 0
        )
        
        for category, data in result.items():
            if data['total'] < 0 and total_expenses > 0:
                data['percentage'] = round(abs(data['total']) / total_expenses * 100, 2)
        
        return result
    
    def _analyze_monthly(
        self,
        transactions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Analyze transactions by month.
        
        Args:
            transactions: List of transactions
        
        Returns:
            List of monthly summaries
        """
        months = defaultdict(lambda: {
            'income': 0.0,
            'expenses': 0.0,
            'net': 0.0,
            'count': 0
        })
        
        for txn in transactions:
            date = txn.get('date', '')
            if not date or len(date) < 7:
                continue
            
            month = date[:7]  # YYYY-MM
            amount = txn.get('amount', 0)
            
            months[month]['count'] += 1
            months[month]['net'] += amount
            
            if amount > 0:
                months[month]['income'] += amount
            else:
                months[month]['expenses'] += abs(amount)
        
        # Convert to list and sort
        result = []
        for month, data in sorted(months.items()):
            result.append({
                'month': month,
                'income': round(data['income'], 2),
                'expenses': round(data['expenses'], 2),
                'net': round(data['net'], 2),
                'transaction_count': data['count']
            })
        
        return result
    
    def _analyze_merchants(
        self,
        transactions: List[Dict[str, Any]],
        top_n: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Analyze top merchants by spending.
        
        Args:
            transactions: List of transactions
            top_n: Number of top merchants to return
        
        Returns:
            List of top merchants
        """
        merchants = defaultdict(lambda: {
            'count': 0,
            'total': 0.0,
            'average': 0.0
        })
        
        for txn in transactions:
            if txn.get('amount', 0) >= 0:  # Skip income
                continue
            
            merchant = self._normalize_merchant(txn.get('description', ''))
            amount = abs(txn.get('amount', 0))
            
            merchants[merchant]['count'] += 1
            merchants[merchant]['total'] += amount
        
        # Convert to list and sort
        result = []
        for merchant, data in merchants.items():
            result.append({
                'merchant': merchant,
                'count': data['count'],
                'total': round(data['total'], 2),
                'average': round(data['total'] / data['count'], 2) if data['count'] > 0 else 0
            })
        
        # Sort by total and return top N
        result.sort(key=lambda x: x['total'], reverse=True)
        return result[:top_n]
    
    def _normalize_merchant(self, description: str) -> str:
        """Normalize merchant name from description."""
        merchant = description.lower()
        
        # Remove common suffixes
        suffixes = [' payment', ' transaction', ' debit', ' charge']
        for suffix in suffixes:
            merchant = merchant.replace(suffix, '')
        
        merchant = ' '.join(merchant.split())
        return merchant.strip()
    
    def get_cash_flow(
        self,
        months: int = 12
    ) -> List[Dict[str, Any]]:
        """
        Get cash flow analysis for recent months.
        
        Args:
            months: Number of months to analyze
        
        Returns:
            List of monthly cash flow data
        """
        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=months * 30)
        
        transactions = self.ledger.get_all_transactions(
            start_date=start_date.strftime('%Y-%m-%d'),
            end_date=end_date.strftime('%Y-%m-%d')
        )
        
        return self._analyze_monthly(transactions)
    
    def get_category_trends(
        self,
        category: str,
        months: int = 6
    ) -> List[Dict[str, Any]]:
        """
        Get spending trends for a specific category.
        
        Args:
            category: Category to analyze
            months: Number of months to analyze
        
        Returns:
            List of monthly category data
        """
        end_date = datetime.now()
        start_date = end_date - timedelta(days=months * 30)
        
        transactions = self.ledger.get_all_transactions(
            start_date=start_date.strftime('%Y-%m-%d'),
            end_date=end_date.strftime('%Y-%m-%d'),
            category=category
        )
        
        return self._analyze_monthly(transactions)
    
    def get_financial_health_score(self) -> Dict[str, Any]:
        """
        Calculate overall financial health score.
        
        Returns:
            Dictionary with health metrics and score
        """
        # Get summary for last 12 months
        summary = self.generate_summary()
        
        metrics = {}
        
        # Savings rate score (0-25)
        if summary.savings_rate >= 20:
            metrics['savings_score'] = 25
        elif summary.savings_rate >= 10:
            metrics['savings_score'] = 20
        elif summary.savings_rate >= 5:
            metrics['savings_score'] = 15
        elif summary.savings_rate > 0:
            metrics['savings_score'] = 10
        else:
            metrics['savings_score'] = 0
        
        # Expense consistency score (0-25)
        if summary.monthly_summary:
            expenses = [m['expenses'] for m in summary.monthly_summary]
            if len(expenses) > 1:
                expense_variance = statistics.stdev(expenses) / statistics.mean(expenses) if statistics.mean(expenses) > 0 else 0
                if expense_variance < 0.1:
                    metrics['consistency_score'] = 25
                elif expense_variance < 0.2:
                    metrics['consistency_score'] = 20
                elif expense_variance < 0.3:
                    metrics['consistency_score'] = 15
                else:
                    metrics['consistency_score'] = 10
            else:
                metrics['consistency_score'] = 15
        else:
            metrics['consistency_score'] = 0
        
        # Income vs Expense score (0-25)
        if summary.total_income > summary.total_expenses:
            ratio = summary.total_expenses / summary.total_income if summary.total_income > 0 else 1
            if ratio < 0.7:
                metrics['budget_score'] = 25
            elif ratio < 0.8:
                metrics['budget_score'] = 20
            elif ratio < 0.9:
                metrics['budget_score'] = 15
            else:
                metrics['budget_score'] = 10
        else:
            metrics['budget_score'] = 0
        
        # Categorization score (0-25)
        total_txns = summary.transaction_count
        categorized = sum(
            data['count'] for cat, data in summary.category_breakdown.items()
            if cat != 'Needs Review'
        )
        categorization_rate = categorized / total_txns if total_txns > 0 else 0
        metrics['categorization_score'] = int(categorization_rate * 25)
        
        # Total score
        total_score = sum(metrics.values())
        
        return {
            'total_score': total_score,
            'max_score': 100,
            'rating': self._score_to_rating(total_score),
            'metrics': metrics,
            'summary': {
                'savings_rate': summary.savings_rate,
                'total_income': summary.total_income,
                'total_expenses': summary.total_expenses
            }
        }
    
    def _score_to_rating(self, score: int) -> str:
        """Convert score to rating string."""
        if score >= 80:
            return 'Excellent'
        elif score >= 60:
            return 'Good'
        elif score >= 40:
            return 'Fair'
        elif score >= 20:
            return 'Poor'
        else:
            return 'Critical'


def analyze_finances(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    config: Optional[Config] = None,
    ledger: Optional[Ledger] = None
) -> FinancialSummary:
    """
    Convenience function to generate financial summary.
    
    Args:
        start_date: Start of analysis period
        end_date: End of analysis period
        config: Configuration object
        ledger: Ledger instance
    
    Returns:
        FinancialSummary object
    """
    analyzer = FinancialAnalyzer(config=config, ledger=ledger)
    return analyzer.generate_summary(start_date, end_date)
