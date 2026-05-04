"""
LLM-Based Transaction Categorization.

Categorizes transactions that couldn't be classified by rule-based
methods. Implements chunking to stay within the LLM's token limit
and batch processing for efficiency.

IMPROVEMENTS APPLIED:
- Merchant caching for faster re-categorization
- Proper handling of INTEGER cents from database
- Enhanced error handling
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

from core.config import Config
from core.llm_client import LLMClient
from core.ledger import Ledger, cents_to_dollars

logger = logging.getLogger(__name__)


@dataclass
class CategorizationResult:
    """Result of LLM categorization for a single transaction."""
    index: int
    category: str
    confidence: float
    reason: str
    success: bool
    error: Optional[str] = None


class LLMCategorizer:
    """
    LLM-based transaction categorizer with chunking support.

    The categorizer:
    1. Fetches uncategorized transactions from the ledger
    2. Uses merchant cache for known merchants (fast path)
    3. Chunks remaining into batches that fit within token limits
    4. Sends each batch to the LLM for classification
    5. Parses and validates the responses
    6. Updates the ledger with new categories

    The chunking strategy ensures we never exceed the 4K token limit
    while maximizing throughput.
    """

    # Estimated tokens per transaction in the prompt
    TOKENS_PER_TRANSACTION = 35

    # Safety margin for prompt overhead
    PROMPT_OVERHEAD = 500

    def __init__(
        self,
        config: Optional[Config] = None,
        llm_client: Optional[LLMClient] = None,
        ledger: Optional[Ledger] = None
    ):
        """
        Initialize the LLM categorizer.

        Args:
            config: Configuration object
            llm_client: LLM client instance
            ledger: Ledger instance for database operations
        """
        self.config = config or Config()
        self.llm_client = llm_client or LLMClient(self.config)
        self.ledger = ledger or Ledger(self.config)

        # Calculate optimal batch size based on token limit
        self.batch_size = self._calculate_batch_size()

        # Merchant cache: normalized_merchant -> category
        self.merchant_cache: Dict[str, str] = {}
        self._load_merchant_cache()

        self.stats = {
            'total_processed': 0,
            'categorized': 0,
            'cached': 0,
            'failed': 0,
            'batches_sent': 0,
            'avg_confidence': 0.0,
            # Internal counters used to compute a true weighted running average.
            # Not exposed in get_stats() but tracked here for correctness.
            '_confidence_sum': 0.0,
            '_confidence_count': 0,
        }

        logger.info(
            f"LLMCategorizer initialized with batch_size={self.batch_size}, "
            f"merchant_cache_size={len(self.merchant_cache)}"
        )

    def _load_merchant_cache(self):
        """Load merchant categories from the ledger."""
        self.merchant_cache = self.ledger.get_merchant_categories()
        logger.debug(f"Loaded {len(self.merchant_cache)} merchant categories from ledger")

    def _calculate_batch_size(self) -> int:
        """
        Calculate optimal batch size based on token limits.

        Returns:
            Recommended batch size
        """
        available_tokens = self.config.llm_max_tokens - self.PROMPT_OVERHEAD
        calculated = available_tokens // self.TOKENS_PER_TRANSACTION

        # Use configured batch size if smaller
        return min(calculated, self.config.llm_batch_size)

    def _normalize_merchant(self, description: str) -> str:
        """
        Normalize merchant name for cache lookup.
        
        Args:
            description: Transaction description
            
        Returns:
            Normalized merchant name (lowercase, stripped)
        """
        return description.lower().strip()

    def _categorize_with_cache(
        self,
        transactions: List[Dict[str, Any]]
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Categorize transactions using merchant cache first.
        
        Args:
            transactions: List of transaction dictionaries
            
        Returns:
            Tuple of (cached_transactions, uncached_transactions)
        """
        cached = []
        uncached = []
        
        for txn in transactions:
            merchant = self._normalize_merchant(txn.get('description', ''))
            
            if merchant in self.merchant_cache:
                txn['category'] = self.merchant_cache[merchant]
                txn['category_source'] = 'merchant_cache'
                cached.append(txn)
                self.stats['cached'] += 1
            else:
                uncached.append(txn)
        
        logger.debug(f"Cache hit: {len(cached)}, Cache miss: {len(uncached)}")
        return cached, uncached

    def _update_merchant_cache(self, transactions: List[Dict[str, Any]], results: List[CategorizationResult]):
        """
        Update merchant cache with new categorizations.
        
        Args:
            transactions: Original transactions
            results: Categorization results
        """
        for result in results:
            if result.success and result.confidence >= 0.7:
                if result.index < len(transactions):
                    txn = transactions[result.index]
                    merchant = self._normalize_merchant(txn.get('description', ''))
                    
                    # Only cache high-confidence categorizations
                    if merchant not in self.merchant_cache:
                        self.merchant_cache[merchant] = result.category
                        logger.debug(f"Added to cache: {merchant} -> {result.category}")

    def categorize_uncategorized(self, limit: Optional[int] = None) -> int:
        """
        Categorize all uncategorized transactions in the ledger.

        Args:
            limit: Maximum number of transactions to process

        Returns:
            Number of transactions successfully categorized
        """
        # Fetch uncategorized transactions
        transactions = self.ledger.get_uncategorized_transactions(limit=limit)

        if not transactions:
            logger.info("No uncategorized transactions found")
            return 0

        logger.info(f"Found {len(transactions)} uncategorized transactions")

        # First, try merchant cache
        cached_txns, remaining_txns = self._categorize_with_cache(transactions)
        
        # Update ledger with cached categories
        if cached_txns:
            updates = [(t['id'], t['category']) for t in cached_txns]
            self.ledger.update_categories_batch(updates)
            logger.info(f"Applied {len(cached_txns)} cached merchant categories")

        if not remaining_txns:
            return len(cached_txns)

        # Process remaining in batches
        categorized_count = len(cached_txns)

        for i in range(0, len(remaining_txns), self.batch_size):
            batch = remaining_txns[i:i + self.batch_size]
            batch_num = (i // self.batch_size) + 1
            total_batches = (len(remaining_txns) + self.batch_size - 1) // self.batch_size

            logger.info(
                f"Processing batch {batch_num}/{total_batches} "
                f"({len(batch)} transactions)"
            )

            results = self._categorize_batch(batch)
            categorized_count += self._apply_results(batch, results)
            
            # Update cache with high-confidence results
            self._update_merchant_cache(batch, results)

        logger.info(
            f"LLM categorization complete: {categorized_count} transactions categorized "
            f"({self.stats['cached']} from cache)"
        )

        return categorized_count

    def _categorize_batch(
        self,
        transactions: List[Dict[str, Any]]
    ) -> List[CategorizationResult]:
        """
        Categorize a batch of transactions using the LLM.

        Args:
            transactions: List of transaction dictionaries

        Returns:
            List of CategorizationResult objects
        """
        # Prepare transaction data for the prompt
        txn_data = [
            {
                'index': idx,
                'date': txn.get('date', ''),
                'description': txn.get('description', ''),
                'amount': txn.get('amount', 0)
            }
            for idx, txn in enumerate(transactions)
        ]

        # Call LLM
        results, response = self.llm_client.categorize_transactions_batch(
            txn_data,
            self.config.valid_categories
        )

        self.stats['batches_sent'] += 1

        if not response.success:
            logger.error(f"LLM request failed: {response.error_message}")
            # Return default results for all transactions
            return [
                CategorizationResult(
                    index=idx,
                    category='Needs Review',
                    confidence=0.0,
                    reason=f"LLM error: {response.error_message}",
                    success=False
                )
                for idx in range(len(transactions))
            ]

        # Parse results
        parsed_results = self._parse_llm_response(results, transactions)

        return parsed_results

    def _parse_llm_response(
        self,
        results: Optional[List[Dict]],
        transactions: List[Dict[str, Any]]
    ) -> List[CategorizationResult]:
        """
        Parse LLM response into CategorizationResult objects.

        Args:
            results: Raw LLM response data
            transactions: Original transactions

        Returns:
            List of CategorizationResult objects
        """
        parsed = []

        if not results:
            # No valid response, mark all for review
            for idx in range(len(transactions)):
                parsed.append(CategorizationResult(
                    index=idx,
                    category='Needs Review',
                    confidence=0.0,
                    reason='No valid LLM response',
                    success=False
                ))
            return parsed

        # Create a mapping from index to result
        result_map = {}
        for item in results:
            try:
                idx = item.get('index', 0)
                category = item.get('category', 'Needs Review')
                confidence = item.get('confidence', 0.5)
                reason = item.get('reason', '')

                # Validate category
                if category not in self.config.valid_categories:
                    logger.warning(f"Invalid category '{category}', using 'Needs Review'")
                    category = 'Needs Review'

                # Validate confidence
                confidence = max(0.0, min(1.0, float(confidence)))

                result_map[idx] = CategorizationResult(
                    index=idx,
                    category=category,
                    confidence=confidence,
                    reason=reason,
                    success=True
                )

            except (KeyError, TypeError, ValueError) as e:
                logger.warning(f"Failed to parse result item: {e}")

        # Fill in missing indices
        for idx in range(len(transactions)):
            if idx in result_map:
                parsed.append(result_map[idx])
            else:
                parsed.append(CategorizationResult(
                    index=idx,
                    category='Needs Review',
                    confidence=0.0,
                    reason='No result for this transaction',
                    success=False
                ))

        return parsed

    def _apply_results(
        self,
        transactions: List[Dict[str, Any]],
        results: List[CategorizationResult]
    ) -> int:
        """
        Apply categorization results to the ledger.

        Args:
            transactions: Original transactions
            results: Categorization results

        Returns:
            Number of successful updates
        """
        updates = []
        confidences = []

        for result in results:
            if result.index < len(transactions):
                txn = transactions[result.index]
                txn_id = txn.get('id')

                if txn_id:
                    updates.append((txn_id, result.category))
                    confidences.append(result.confidence)

                    if result.success:
                        self.stats['categorized'] += 1
                    else:
                        self.stats['failed'] += 1

        # Batch update the ledger
        if updates:
            self.ledger.update_categories_batch(updates)

        # Update statistics
        self.stats['total_processed'] += len(results)
        if confidences:
            # True weighted running average across all batches.
            # (current_avg + new_avg) / 2 would incorrectly weight each batch
            # equally regardless of size; instead we track the cumulative sum
            # and count so that avg = total_sum / total_count at all times.
            self.stats['_confidence_sum'] += sum(confidences)
            self.stats['_confidence_count'] += len(confidences)
            self.stats['avg_confidence'] = (
                self.stats['_confidence_sum'] / self.stats['_confidence_count']
            )

        return len(updates)

    def categorize_transactions_direct(
        self,
        transactions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Categorize transactions directly (without ledger).

        Useful for categorizing new transactions before inserting them.

        Args:
            transactions: List of transaction dictionaries

        Returns:
            List of transactions with added category field
        """
        # Try cache first
        cached, remaining = self._categorize_with_cache(transactions)
        
        if not remaining:
            return cached
        
        # Categorize remaining with LLM
        results = self._categorize_batch(remaining)

        # Apply categories to transactions
        for i, result in enumerate(results):
            if i < len(remaining):
                remaining[i]['category'] = result.category
                remaining[i]['category_confidence'] = result.confidence
                remaining[i]['category_reason'] = result.reason

        return cached + remaining

    def get_stats(self) -> Dict[str, Any]:
        """Get categorization statistics (excludes internal tracking fields)."""
        return {k: v for k, v in self.stats.items() if not k.startswith('_')}

    def close(self):
        """Close the LLM client connection."""
        self.llm_client.close()

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()


def categorize_with_llm(
    transactions: List[Dict[str, Any]],
    config: Optional[Config] = None
) -> List[Dict[str, Any]]:
    """
    Convenience function to categorize transactions using LLM.

    Args:
        transactions: List of transaction dictionaries
        config: Configuration object

    Returns:
        List of transactions with added categories
    """
    categorizer = LLMCategorizer(config=config)
    try:
        return categorizer.categorize_transactions_direct(transactions)
    finally:
        categorizer.close()


def categorize_uncategorized_in_ledger(
    config: Optional[Config] = None,
    limit: Optional[int] = None
) -> int:
    """
    Convenience function to categorize uncategorized transactions in ledger.

    Args:
        config: Configuration object
        limit: Maximum number of transactions to process

    Returns:
        Number of transactions categorized
    """
    categorizer = LLMCategorizer(config=config)
    try:
        return categorizer.categorize_uncategorized(limit=limit)
    finally:
        categorizer.close()
