"""
LLM Client for local inference via llama.cpp.

Provides a robust interface for communicating with a locally-hosted
LLM server. Implements retry logic, chunking, and structured output parsing.

SECURITY FIXES APPLIED:
- Prompt injection protection via description sanitization
- Input validation for transaction data
- Truncation of long descriptions
"""

import json
import logging
import re
import time
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

import requests
from requests.exceptions import RequestException, Timeout, ConnectionError

from .config import Config

logger = logging.getLogger(__name__)


# Prompt injection patterns to detect and neutralize
PROMPT_INJECTION_PATTERNS = [
    r'ignore\s+(previous|all|above)',
    r'new\s+instruction',
    r'system\s*(prompt|instruction|:)',  # catches "system:", "System:", "system prompt" etc.
    r'assistant:',
    r'user:',
    r'\[INST\]',
    r'\[/INST\]',
    r'<\|.*?\|>',
    r'###\s*(Human|Assistant|System)',
    r'begin\s+output',
    r'end\s+output',
    r'output\s+only',
    r'bypass\s+(all|security|restrictions)',
    r'override\s+(previous|all)',
    # SQL injection keywords
    r'\b(DROP|ALTER|DELETE|INSERT|UPDATE|CREATE|EXEC|UNION|SELECT)\b',
]

# Maximum description length for prompts (prevents prompt flooding)
MAX_DESCRIPTION_LENGTH = 100


@dataclass
class LLMResponse:
    """Container for LLM response data."""
    content: str
    usage: Dict[str, int]
    success: bool
    error_message: Optional[str] = None


class LLMClient:
    """
    Client for interacting with a local LLM server (llama.cpp).

    Features:
    - Automatic retry with exponential backoff
    - Structured JSON output parsing
    - Batch processing support
    - Token usage tracking
    - Prompt injection protection
    
    The client is designed to work with the llama.cpp server endpoint:
    http://localhost:8080/v1/chat/completions
    """

    def __init__(self, config: Optional[Config] = None):
        """
        Initialize the LLM client.

        Args:
            config: Configuration object. Uses default if not provided.
        """
        self.config = config or Config()
        self.session = requests.Session()
        self.session.headers.update(self.config.llm_headers)

        # Retry configuration
        self.max_retries = 3
        self.base_delay = 1.0  # seconds

        # Compile injection patterns for efficiency
        self.injection_patterns = [
            re.compile(pattern, re.IGNORECASE)
            for pattern in PROMPT_INJECTION_PATTERNS
        ]

        logger.info(
            f"LLMClient initialized with endpoint: {self.config.llm_endpoint}"
        )

    def _sanitize_description(self, description: str) -> str:
        """
        Sanitize transaction description to prevent prompt injection.
        
        This method:
        1. Removes potential prompt injection patterns
        2. Truncates to safe length
        3. Escapes special characters
        
        Args:
            description: Raw transaction description
            
        Returns:
            Sanitized description safe for use in prompts
        """
        if not description:
            return ""
        
        sanitized = str(description)
        
        # Remove prompt injection patterns
        for pattern in self.injection_patterns:
            sanitized = pattern.sub('', sanitized)
        
        # Remove or escape special characters that could affect JSON
        # Keep alphanumeric, spaces, and common punctuation
        sanitized = re.sub(r'[^\w\s\-\.\,\(\)\&\']', ' ', sanitized)
        
        # Normalize whitespace
        sanitized = ' '.join(sanitized.split())
        
        # Truncate to safe length
        if len(sanitized) > MAX_DESCRIPTION_LENGTH:
            sanitized = sanitized[:MAX_DESCRIPTION_LENGTH - 3] + '...'
        
        return sanitized.strip()

    def _validate_transaction(self, txn: Dict[str, Any]) -> bool:
        """
        Validate transaction data before including in prompt.
        
        Args:
            txn: Transaction dictionary
            
        Returns:
            True if valid, False otherwise
        """
        # Check required fields
        if not txn.get('date'):
            return False
        if not txn.get('description'):
            return False
        if 'amount' not in txn:
            return False
        
        # Validate date format (YYYY-MM-DD)
        date = str(txn.get('date', ''))
        if not re.match(r'^\d{4}-\d{2}-\d{2}$', date):
            return False
        
        # Validate amount is a number
        try:
            float(txn.get('amount', 0))
        except (TypeError, ValueError):
            return False
        
        return True

    def _retry_request(self, payload: Dict) -> Tuple[Optional[Dict], Optional[str]]:
        """
        Make HTTP request with exponential backoff retry logic.

        Args:
            payload: Request payload dictionary

        Returns:
            Tuple of (response_dict, error_message)
        """
        last_error = None

        for attempt in range(self.max_retries):
            try:
                response = self.session.post(
                    self.config.llm_endpoint,
                    json=payload,
                    timeout=self.config.llm_timeout
                )
                response.raise_for_status()
                return response.json(), None

            except Timeout as e:
                last_error = f"Request timeout (attempt {attempt + 1}/{self.max_retries})"
                logger.warning(last_error)

            except ConnectionError as e:
                last_error = f"Connection error (attempt {attempt + 1}/{self.max_retries})"
                logger.warning(last_error)
                # Check if server is running
                if attempt == 0:
                    logger.error(
                        "Cannot connect to LLM server. Ensure llama.cpp server is running:\n"
                        "  ./server -m <model_path> -c 4096 --port 8080"
                    )

            except RequestException as e:
                last_error = f"Request failed (attempt {attempt + 1}/{self.max_retries}): {str(e)}"
                logger.warning(last_error)

            except json.JSONDecodeError as e:
                last_error = f"Invalid JSON response: {str(e)}"
                logger.error(last_error)
                return None, last_error

            except Exception as e:
                last_error = f"Unexpected error (attempt {attempt + 1}/{self.max_retries}): {str(e)}"
                logger.warning(last_error)

            # Exponential backoff
            if attempt < self.max_retries - 1:
                delay = self.base_delay * (2 ** attempt)
                logger.info(f"Retrying in {delay:.1f} seconds...")
                time.sleep(delay)

        return None, last_error

    def chat(self, messages: List[Dict[str, str]]) -> LLMResponse:
        """
        Send a chat completion request to the LLM.

        Args:
            messages: List of message dictionaries with 'role' and 'content'

        Returns:
            LLMResponse object with parsed content
        """
        payload = self.config.get_llm_payload(messages)

        logger.debug(f"Sending LLM request with {len(messages)} messages")

        response_data, error = self._retry_request(payload)

        if error:
            return LLMResponse(
                content="",
                usage={},
                success=False,
                error_message=error
            )

        try:
            # Extract content from response
            choice = response_data.get("choices", [{}])[0]
            content = choice.get("message", {}).get("content", "")
            usage = response_data.get("usage", {})

            return LLMResponse(
                content=content,
                usage=usage,
                success=True
            )

        except (KeyError, IndexError) as e:
            return LLMResponse(
                content="",
                usage={},
                success=False,
                error_message=f"Failed to parse LLM response: {str(e)}"
            )

    def chat_with_json(self, messages: List[Dict[str, str]]) -> Tuple[Optional[Any], LLMResponse]:
        """
        Send a chat request and parse the response as JSON.

        Args:
            messages: List of message dictionaries

        Returns:
            Tuple of (parsed_json_or_None, LLMResponse)
        """
        # Add instruction for JSON output
        system_instruction = (
            "You must respond with valid JSON only. No markdown, no explanations. "
            "Ensure all strings are properly escaped."
        )

        # Check if there's already a system message
        has_system = any(m.get("role") == "system" for m in messages)

        if not has_system:
            messages = [{"role": "system", "content": system_instruction}] + messages

        response = self.chat(messages)

        if not response.success:
            return None, response

        # Parse JSON response
        try:
            # Try to extract JSON from the content
            json_content = self._extract_json(response.content)
            parsed = json.loads(json_content)
            return parsed, response

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            logger.debug(f"Raw content: {response.content[:500]}")
            return None, LLMResponse(
                content=response.content,
                usage=response.usage,
                success=False,
                error_message=f"JSON parsing failed: {str(e)}"
            )

    def _extract_json(self, content: str) -> str:
        """
        Extract JSON from content that may contain markdown or other text.

        Args:
            content: Raw content string

        Returns:
            Cleaned JSON string
        """
        content = content.strip()

        # Remove markdown code blocks if present
        if content.startswith("```"):
            # Find the JSON content within code blocks
            lines = content.split("\n")
            json_lines = []
            in_json = False

            for line in lines:
                if line.startswith("```json") or line.startswith("```"):
                    in_json = not in_json
                    continue
                if in_json or not line.startswith("```"):
                    json_lines.append(line)

            content = "\n".join(json_lines)

        # Remove any trailing markdown or explanations by finding the
        # correct outermost closing bracket.  Determine the expected closing
        # character from whichever opening bracket appears first.
        stripped = content.lstrip()
        end_char = "]" if stripped.startswith("[") else "}"
        last_pos = content.rfind(end_char)
        if last_pos != -1:
            content = content[:last_pos + 1]

        return content.strip()

    def categorize_transactions_batch(
        self,
        transactions: List[Dict[str, Any]],
        categories: List[str]
    ) -> Tuple[Optional[List[Dict]], LLMResponse]:
        """
        Categorize a batch of transactions using the LLM.

        Args:
            transactions: List of transaction dictionaries
            categories: List of valid category names

        Returns:
            Tuple of (categorized_transactions_or_None, LLMResponse)
        """
        # Filter and sanitize transactions
        valid_transactions = []
        for txn in transactions:
            if self._validate_transaction(txn):
                # Create a sanitized copy
                sanitized_txn = {
                    'index': len(valid_transactions),
                    'date': txn.get('date', ''),
                    'description': self._sanitize_description(txn.get('description', '')),
                    'amount': txn.get('amount', 0)
                }
                valid_transactions.append(sanitized_txn)
            else:
                logger.warning(f"Invalid transaction skipped: {txn}")

        if not valid_transactions:
            return [], LLMResponse(
                content="",
                usage={},
                success=False,
                error_message="No valid transactions to categorize"
            )

        # Build the prompt
        transactions_text = self._format_transactions_for_prompt(valid_transactions)
        categories_text = ", ".join(categories)

        prompt = f"""You are an expert financial accountant. Categorize the following bank transactions.

Available categories: {categories_text}

Transactions to categorize:
{transactions_text}

Return a JSON array where each object has:
- "index": the transaction index (0-based)
- "category": the assigned category
- "confidence": your confidence (0.0 to 1.0)
- "reason": brief explanation

Example output:
[{{"index": 0, "category": "Food", "confidence": 0.95, "reason": "Restaurant payment"}}, ...]

Respond with ONLY the JSON array, no other text."""

        messages = [
            {"role": "system", "content": "You are a precise financial classifier. Output valid JSON only."},
            {"role": "user", "content": prompt}
        ]

        return self.chat_with_json(messages)

    def _format_transactions_for_prompt(self, transactions: List[Dict]) -> str:
        """
        Format transactions as a readable string for the LLM prompt.

        Args:
            transactions: List of sanitized transaction dictionaries

        Returns:
            Formatted string representation
        """
        lines = []
        for i, txn in enumerate(transactions):
            date = txn.get("date", "Unknown")
            desc = txn.get("description", "Unknown")
            amount = txn.get("amount", 0)

            # Format amount with sign indicator
            sign = "DEBIT" if amount < 0 else "CREDIT"
            lines.append(
                f"{i}. [{date}] {desc} | Amount: {abs(amount):.2f} ({sign})"
            )

        return "\n".join(lines)

    def health_check(self) -> bool:
        """
        Check if the LLM server is running and responsive.

        Returns:
            True if server is healthy, False otherwise
        """
        try:
            # Simple test request
            test_payload = {
                "model": self.config.llm_model,
                "messages": [{"role": "user", "content": "Hello"}],
                "max_tokens": 5
            }

            response = self.session.post(
                self.config.llm_endpoint,
                json=test_payload,
                timeout=10
            )
            response.raise_for_status()
            return True

        except Exception as e:
            logger.warning(f"LLM health check failed: {e}")
            return False

    def close(self):
        """Close the HTTP session."""
        self.session.close()

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()
