"""
Tests for categorization modules.

Tests cover:
- Rule-based categorization
- LLM categorization with caching
- Category validation
"""

import pytest
import json
from pathlib import Path
from unittest.mock import Mock, patch
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.categorize_rules import RuleCategorizer, CategorizationRule
from core.config import Config


class TestCategorizationRule:
    """Test individual categorization rules."""

    def test_keyword_match(self):
        """Test basic keyword matching."""
        rule = CategorizationRule(
            keywords=['netflix'],
            category='Subscription',
            priority=10
        )
        
        assert rule.matches("Netflix subscription", -15.99)
        assert rule.matches("NETFLIX.COM", -15.99)
        assert not rule.matches("Amazon Prime", -15.99)

    def test_case_insensitive_match(self):
        """Test that matching is case insensitive."""
        rule = CategorizationRule(
            keywords=['Starbucks'],
            category='Food',
            priority=9
        )
        
        assert rule.matches("STARBUCKS COFFEE", -5.50)
        assert rule.matches("starbucks", -5.50)
        assert rule.matches("StarBucks", -5.50)

    def test_exact_match(self):
        """Test exact match mode."""
        rule = CategorizationRule(
            keywords=['rent'],
            category='Rent',
            priority=10,
            exact_match=True
        )
        
        assert rule.matches("rent", -2000)
        assert not rule.matches("rent payment", -2000)
        assert not rule.matches("monthly rent", -2000)

    def test_amount_constraints(self):
        """Test amount-based rule filtering."""
        rule = CategorizationRule(
            keywords=['rent'],
            category='Rent',
            priority=10,
            amount_min=1000,
            amount_max=5000
        )
        
        assert rule.matches("rent", -2000)
        assert not rule.matches("rent", -500)  # Below min
        assert not rule.matches("rent", -10000)  # Above max


class TestRuleCategorizer:
    """Test rule-based categorizer."""

    def test_categorizes_with_matching_rule(self, test_config, sample_rules):
        """Test categorization when rule matches."""
        # Write rules to file
        with open(test_config.merchant_rules_path, 'w') as f:
            json.dump(sample_rules, f)
        
        categorizer = RuleCategorizer(test_config)
        
        transactions = [
            {'description': 'Netflix subscription', 'amount': -15.99}
        ]
        
        categorized, uncategorized = categorizer.categorize_batch(transactions)
        
        assert len(categorized) == 1
        assert categorized[0]['category'] == 'Subscription'
        assert len(uncategorized) == 0

    def test_uncategorized_when_no_match(self, test_config, sample_rules):
        """Test when no rule matches."""
        with open(test_config.merchant_rules_path, 'w') as f:
            json.dump(sample_rules, f)
        
        categorizer = RuleCategorizer(test_config)
        
        transactions = [
            {'description': 'Unknown merchant XYZ', 'amount': -50.00}
        ]
        
        categorized, uncategorized = categorizer.categorize_batch(transactions)
        
        assert len(categorized) == 0
        assert len(uncategorized) == 1
        assert uncategorized[0]['category'] == 'Needs Review'

    def test_priority_ordering(self, test_config):
        """Test that higher priority rules are checked first."""
        rules = [
            {"keywords": ["payment"], "category": "Transfer", "priority": 5},
            {"keywords": ["netflix"], "category": "Subscription", "priority": 10},
        ]
        
        with open(test_config.merchant_rules_path, 'w') as f:
            json.dump(rules, f)
        
        categorizer = RuleCategorizer(test_config)
        
        # Should match Netflix (priority 10) not payment (priority 5)
        category, rule = categorizer.categorize_single({
            'description': 'Netflix payment',
            'amount': -15.99
        })
        
        assert category == 'Subscription'

    def test_tracks_rule_usage(self, test_config, sample_rules):
        """Test that rule usage is tracked."""
        with open(test_config.merchant_rules_path, 'w') as f:
            json.dump(sample_rules, f)
        
        categorizer = RuleCategorizer(test_config)
        
        transactions = [
            {'description': 'Netflix', 'amount': -15.99},
            {'description': 'Netflix', 'amount': -15.99},
            {'description': 'Starbucks', 'amount': -5.50},
        ]
        
        categorizer.categorize_batch(transactions)
        
        stats = categorizer.get_stats()
        assert 'rules_used' in stats
        assert len(stats['rules_used']) > 0


class TestLLMCategorizer:
    """Test LLM-based categorizer with caching."""

    @patch('scripts.categorize_llm.LLMClient')
    def test_uses_merchant_cache(self, mock_llm_client, populated_ledger):
        """Test that merchant cache is used for known merchants."""
        from scripts.categorize_llm import LLMCategorizer
        
        # First, categorize a transaction directly
        populated_ledger.update_category(1, 'Subscription')
        
        categorizer = LLMCategorizer(ledger=populated_ledger)
        
        # Cache should be loaded
        assert len(categorizer.merchant_cache) > 0

    @patch('scripts.categorize_llm.LLMClient')
    def test_updates_cache_with_high_confidence(self, mock_llm_client, ledger):
        """Test that cache is updated with high-confidence results."""
        from scripts.categorize_llm import LLMCategorizer, CategorizationResult
        
        categorizer = LLMCategorizer(ledger=ledger)
        
        transactions = [
            {'id': 1, 'description': 'New Merchant ABC', 'amount': -50.00}
        ]
        
        results = [
            CategorizationResult(
                index=0,
                category='Shopping',
                confidence=0.95,
                reason='Test',
                success=True
            )
        ]
        
        categorizer._update_merchant_cache(transactions, results)
        
        assert 'new merchant abc' in categorizer.merchant_cache
        assert categorizer.merchant_cache['new merchant abc'] == 'Shopping'

    @patch('scripts.categorize_llm.LLMClient')
    def test_does_not_cache_low_confidence(self, mock_llm_client, ledger):
        """Test that low-confidence results are not cached."""
        from scripts.categorize_llm import LLMCategorizer, CategorizationResult
        
        categorizer = LLMCategorizer(ledger=ledger)
        
        transactions = [
            {'id': 1, 'description': 'Unknown XYZ', 'amount': -50.00}
        ]
        
        results = [
            CategorizationResult(
                index=0,
                category='Other',
                confidence=0.3,  # Low confidence
                reason='Test',
                success=True
            )
        ]
        
        categorizer._update_merchant_cache(transactions, results)
        
        assert 'unknown xyz' not in categorizer.merchant_cache


class TestCategoryValidation:
    """Test category validation."""

    def test_valid_categories(self, test_config):
        """Test that valid categories are accepted."""
        categorizer = RuleCategorizer(test_config)
        
        for category in test_config.valid_categories:
            # Add a rule for each category
            categorizer.add_rule({
                'keywords': [f'test_{category.lower()}'],
                'category': category,
                'priority': 1
            })
        
        # Should not raise any errors
        category, rule = categorizer.categorize_single({
            'description': f'test_income',
            'amount': 100
        })
        
        assert category in test_config.valid_categories
