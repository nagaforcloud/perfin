"""
Rule-Based Categorization Engine.

Categorizes transactions using predefined merchant rules before
falling back to LLM classification. This is the first line of
categorization and handles the majority of common transactions.

Rules are stored in JSON format and support:
- Keyword matching (case-insensitive)
- Exact merchant name matching
- Amount-based rules
- Category priorities
"""

import json
import re
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field

from core.config import Config

logger = logging.getLogger(__name__)


@dataclass
class CategorizationRule:
    """
    A single categorization rule.
    
    Attributes:
        keywords: List of keywords to match in description
        category: Category to assign if matched
        priority: Higher priority rules are checked first
        exact_match: If True, requires exact description match
        amount_min: Minimum amount for rule to apply (optional)
        amount_max: Maximum amount for rule to apply (optional)
    """
    keywords: List[str]
    category: str
    priority: int = 0
    exact_match: bool = False
    amount_min: Optional[float] = None
    amount_max: Optional[float] = None
    
    def matches(self, description: str, amount: float) -> bool:
        """
        Check if this rule matches a transaction.
        
        Args:
            description: Transaction description
            amount: Transaction amount
        
        Returns:
            True if rule matches
        """
        # Check amount constraints using absolute value so that signed
        # debit amounts (negative) are correctly compared against positive thresholds.
        abs_amount = abs(amount)
        if self.amount_min is not None and abs_amount < self.amount_min:
            return False
        if self.amount_max is not None and abs_amount > self.amount_max:
            return False
        
        desc_lower = description.lower()
        
        if self.exact_match:
            # Exact match (case-insensitive)
            return any(
                desc_lower == kw.lower() for kw in self.keywords
            )
        else:
            # Keyword contains match
            return any(
                kw.lower() in desc_lower for kw in self.keywords
            )


class RuleCategorizer:
    """
    Rule-based transaction categorizer.
    
    Loads rules from a JSON file and applies them to transactions.
    Rules are applied in priority order (highest first).
    
    The categorizer tracks:
    - Matched transactions
    - Unmatched transactions (for LLM processing)
    - Rule usage statistics
    """
    
    # Default rules if no file is found
    DEFAULT_RULES = [
        # Income
        {"keywords": ["salary", "payroll", "direct deposit"], "category": "Income", "priority": 10},
        {"keywords": ["refund", "reimbursement"], "category": "Income", "priority": 10},
        {"keywords": ["interest", "dividend"], "category": "Investment", "priority": 10},
        
        # Food & Dining
        {"keywords": ["swiggy", "zomato", "ubereats", "doordash"], "category": "Food", "priority": 9},
        {"keywords": ["restaurant", "cafe", "coffee", "starbucks"], "category": "Food", "priority": 9},
        {"keywords": ["mcdonald", "burger king", "kfc", "pizza"], "category": "Food", "priority": 9},
        
        # Groceries
        {"keywords": ["walmart", "target", "costco", "whole foods", "trader joe"], "category": "Groceries", "priority": 9},
        {"keywords": ["grocery", "supermarket", "mart"], "category": "Groceries", "priority": 8},
        
        # Transport
        {"keywords": ["uber", "lyft", "ola", "taxi"], "category": "Transport", "priority": 9},
        {"keywords": ["fuel", "gas station", "shell", "bp", "exxon"], "category": "Transport", "priority": 9},
        {"keywords": ["parking", "toll"], "category": "Transport", "priority": 8},
        
        # Shopping
        {"keywords": ["amazon", "ebay", "etsy"], "category": "Shopping", "priority": 9},
        {"keywords": ["nike", "adidas", "clothing", "apparel"], "category": "Shopping", "priority": 8},
        
        # Subscriptions
        {"keywords": ["netflix", "hulu", "disney", "prime video", "hbo"], "category": "Subscription", "priority": 10},
        {"keywords": ["spotify", "apple music", "youtube premium"], "category": "Subscription", "priority": 10},
        {"keywords": ["adobe", "microsoft 365", "office 365"], "category": "Subscription", "priority": 10},
        
        # Utilities
        {"keywords": ["electric", "water", "gas utility", "sewer"], "category": "Utilities", "priority": 9},
        {"keywords": ["internet", "comcast", "verizon", "at&t"], "category": "Utilities", "priority": 9},
        {"keywords": ["phone", "mobile", "wireless"], "category": "Utilities", "priority": 8},
        
        # Rent & Housing
        {"keywords": ["rent", "lease"], "category": "Rent", "priority": 10},
        {"keywords": ["mortgage"], "category": "Rent", "priority": 10},
        {"keywords": ["home depot", "lowes", "hardware"], "category": "Home Maintenance", "priority": 8},
        
        # Insurance
        {"keywords": ["insurance", "premium", "policy"], "category": "Insurance", "priority": 10},
        {"keywords": ["health", "medical", "hospital", "pharmacy", "cvs", "walgreens"], "category": "Medical", "priority": 9},
        
        # Investment
        {"keywords": ["sip", "mutual fund", "401k", "ira", "roth"], "category": "Investment", "priority": 10},
        {"keywords": ["brokerage", "stock", "shares"], "category": "Investment", "priority": 9},
        
        # Transfer
        {"keywords": ["transfer", "venmo", "cash app", "zelle", "paytm", "gpay"], "category": "Transfer", "priority": 8},
        {"keywords": ["atm withdrawal", "cash withdrawal"], "category": "Transfer", "priority": 8},
        
        # Entertainment
        {"keywords": ["movie", "cinema", "theater"], "category": "Entertainment", "priority": 9},
        {"keywords": ["gaming", "playstation", "xbox", "nintendo"], "category": "Entertainment", "priority": 8},
        
        # Travel
        {"keywords": ["hotel", "airbnb", "booking"], "category": "Travel", "priority": 9},
        {"keywords": ["airline", "flight", "airport"], "category": "Travel", "priority": 9},
        
        # Education
        {"keywords": ["tuition", "school", "university", "college"], "category": "Education", "priority": 9},
        {"keywords": ["book", "kindle", "audible"], "category": "Education", "priority": 7},
        
        # Professional
        {"keywords": ["legal", "attorney", "lawyer"], "category": "Professional Services", "priority": 9},
        {"keywords": ["accounting", "tax", "cpa"], "category": "Professional Services", "priority": 9},
        
        # Fees
        {"keywords": ["fee", "charge", "penalty", "late fee"], "category": "Other", "priority": 5},
    ]
    
    def __init__(self, config: Optional[Config] = None, rules_file: Optional[Path] = None):
        """
        Initialize the rule categorizer.
        
        Args:
            config: Configuration object
            rules_file: Path to custom rules file (optional)
        """
        self.config = config or Config()
        self.rules_file = rules_file or self.config.merchant_rules_path
        self.rules: List[CategorizationRule] = []
        self.stats = {
            'total_processed': 0,
            'categorized': 0,
            'uncategorized': 0,
            'rules_used': {}
        }
        
        # Load rules
        self._load_rules()
    
    def _load_rules(self):
        """Load rules from file or use defaults."""
        if self.rules_file.exists():
            try:
                with open(self.rules_file, 'r') as f:
                    rules_data = json.load(f)
                
                self.rules = self._parse_rules(rules_data)
                logger.info(f"Loaded {len(self.rules)} rules from {self.rules_file}")
                
            except (json.JSONDecodeError, IOError) as e:
                logger.warning(f"Failed to load rules file: {e}. Using defaults.")
                self.rules = self._parse_rules(self.DEFAULT_RULES)
        else:
            logger.info("No rules file found. Using default rules.")
            self.rules = self._parse_rules(self.DEFAULT_RULES)
        
        # Sort by priority (highest first)
        self.rules.sort(key=lambda r: r.priority, reverse=True)
    
    def _parse_rules(self, rules_data: List[Dict]) -> List[CategorizationRule]:
        """
        Parse rules from dictionary format.
        
        Args:
            rules_data: List of rule dictionaries
        
        Returns:
            List of CategorizationRule objects
        """
        rules = []
        for rule_data in rules_data:
            keywords = rule_data.get('keywords', [])
            if isinstance(keywords, str):
                keywords = [keywords]
            
            rule = CategorizationRule(
                keywords=keywords,
                category=rule_data.get('category', 'Needs Review'),
                priority=rule_data.get('priority', 0),
                exact_match=rule_data.get('exact_match', False),
                amount_min=rule_data.get('amount_min'),
                amount_max=rule_data.get('amount_max')
            )
            rules.append(rule)
        
        return rules
    
    def categorize_batch(
        self,
        transactions: List[Dict[str, Any]]
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Categorize a batch of transactions using rules.
        
        Args:
            transactions: List of transaction dictionaries
        
        Returns:
            Tuple of (categorized_transactions, uncategorized_transactions)
        """
        categorized = []
        uncategorized = []
        
        self.stats['total_processed'] += len(transactions)
        
        for txn in transactions:
            category, rule = self.categorize_single(txn)
            
            if category:
                txn['category'] = category
                txn['category_source'] = 'rule'
                txn['matched_rule'] = str(rule.keywords) if rule else None
                categorized.append(txn)
                
                # Track rule usage
                rule_key = str(rule.keywords) if rule else 'unknown'
                self.stats['rules_used'][rule_key] = self.stats['rules_used'].get(rule_key, 0) + 1
            else:
                txn['category'] = 'Needs Review'
                txn['category_source'] = None
                uncategorized.append(txn)
        
        self.stats['categorized'] += len(categorized)
        self.stats['uncategorized'] += len(uncategorized)
        
        logger.info(
            f"Rule categorization: {len(categorized)} categorized, "
            f"{len(uncategorized)} need review"
        )
        
        return categorized, uncategorized
    
    def categorize_single(
        self,
        transaction: Dict[str, Any]
    ) -> Tuple[Optional[str], Optional[CategorizationRule]]:
        """
        Categorize a single transaction using rules.
        
        Args:
            transaction: Transaction dictionary
        
        Returns:
            Tuple of (category or None, matching rule or None)
        """
        description = transaction.get('description', '')
        amount = transaction.get('amount', 0)
        
        # Check each rule in priority order
        for rule in self.rules:
            if rule.matches(description, amount):
                return rule.category, rule
        
        return None, None
    
    def add_rule(self, rule_data: Dict[str, Any]):
        """
        Add a new rule dynamically.
        
        Args:
            rule_data: Rule dictionary
        """
        rule = self._parse_rules([rule_data])[0]
        self.rules.append(rule)
        self.rules.sort(key=lambda r: r.priority, reverse=True)
        logger.debug(f"Added rule: {rule.keywords} -> {rule.category}")
    
    def save_rules(self):
        """Save current rules to file."""
        rules_data = []
        for rule in self.rules:
            rules_data.append({
                'keywords': rule.keywords,
                'category': rule.category,
                'priority': rule.priority,
                'exact_match': rule.exact_match,
                'amount_min': rule.amount_min,
                'amount_max': rule.amount_max
            })
        
        with open(self.rules_file, 'w') as f:
            json.dump(rules_data, f, indent=2)
        
        logger.info(f"Saved {len(self.rules)} rules to {self.rules_file}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get categorization statistics."""
        return self.stats.copy()
    
    def get_top_rules(self, n: int = 10) -> List[Tuple[str, int]]:
        """
        Get the most frequently used rules.
        
        Args:
            n: Number of top rules to return
        
        Returns:
            List of (rule_keywords, count) tuples
        """
        sorted_rules = sorted(
            self.stats['rules_used'].items(),
            key=lambda x: x[1],
            reverse=True
        )
        return sorted_rules[:n]


def categorize_with_rules(
    transactions: List[Dict[str, Any]],
    config: Optional[Config] = None
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Convenience function to categorize transactions using rules.
    
    Args:
        transactions: List of transaction dictionaries
        config: Configuration object
    
    Returns:
        Tuple of (categorized, uncategorized) transactions
    """
    categorizer = RuleCategorizer(config)
    return categorizer.categorize_batch(transactions)
