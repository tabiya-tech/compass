import asyncio
import logging
import random
from typing import TypeVar, Generic, Callable, Awaitable, Tuple, Optional

from google.api_core.exceptions import ServerError, TooManyRequests, ResourceExhausted
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Retry logic with exponential backoff and jitter #
T = TypeVar('T')

AsyncCallback = Callable[[], Awaitable[T]]
"""
An asynchronous callback function that performs an operation and returns a result.

:returns: Awaitable of the result (T) of the operation.
:rtype: Awaitable[T]
"""

AsyncCallbackWithPenalty = Callable[[int, int], Awaitable[Tuple[T, float, Optional[BaseException]]]]
"""
An asynchronous callback function that performs an operation and reports its result, error (if any), and a penalty score.

:param attempt: The current retry attempt number (starting from 1).
:param max_retries: The total number of retry attempts allowed.

:returns: Awaitable of a tuple containing:
    - result (T): The output or partial result of the operation.
    - penalty (float): A numeric score representing the penalty of the result (lower is better).
    - error (Optional[BaseException]): An exception instance if the attempt failed, or None if successful.
:rtype: Awaitable[Tuple[T, float, Optional[BaseException]]]
"""


class RetryConfigWithExponentialBackOff(BaseModel):
    """
    Configuration for retry logic with exponential backoff and jitter.
    """
    max_retries: int = 5  # number of retries
    initial_wait: float = 1.0  # in seconds
    base_backoff_factor: float = 2  # For exponential backoff it should be greater than 1 + jitter
    jitter: float = 0.5  # between 0 and 1


DEFAULT_RETRY_CONFIG_WITH_EXP_BACKOFF = RetryConfigWithExponentialBackOff()


class RetryLimitExceededError(Exception):
    """
    Exception for when the maximum number of retry attempts is exceeded.
    """

    def __init__(self, message="Maximum retry attempts exceeded", retries=None):
        self.message = message
        self.retries = retries
        super().__init__(self.message)

    def __str__(self):
        return f"{self.message} after {self.retries} attempts"


class Retry(Generic[T]):
    """
    A generic class for retry logic with exponential backoff and jitter.
    """

    @staticmethod
    async def call_with_exponential_backoff(callback: AsyncCallback[T],
                                            retry_config: RetryConfigWithExponentialBackOff = DEFAULT_RETRY_CONFIG_WITH_EXP_BACKOFF) -> T:
        """ Call `callback()` with exponential backoff and jitter."""
        wait_time = retry_config.initial_wait
        for attempt in range(retry_config.max_retries):
            try:
                result: T = await callback()
                logger.debug("Attempt %d to call %s succeeded", attempt + 1, callback.__name__)
                return result
            except (TooManyRequests, ResourceExhausted, ServerError) as e:
                logger.warning("Attempt %d to call %s failed, error: %s, retrying in %.2f seconds", attempt + 1,
                               callback.__name__, e, wait_time)
                await asyncio.sleep(wait_time)
                wait_time = Retry._get_random_wait_time(wait_time, retry_config.base_backoff_factor,
                                                        retry_config.jitter)
            # rethrow other exceptions
            except Exception as e:
                logger.error("An error occurred", exc_info=True)
                raise e
        raise RetryLimitExceededError(retries=retry_config.max_retries)

    @staticmethod
    def _get_random_wait_time(previous_wait: float, base_backoff_factor: float, jitter: float) -> float:
        # Multiply the backoff factor with a random jitter that varies from 1 - jitter to 1 + jitter
        randomized_backoff = \
            base_backoff_factor * (1 + jitter * (random.random() - 0.5) * 2)  # nosec B311 # random is used for jitter
        return previous_wait * randomized_backoff

    @staticmethod
    async def call_with_penalty(
            *,
            callback: AsyncCallbackWithPenalty[T],
            max_retries: int = 3,
    ) -> tuple[T, float, Optional[BaseException]]:

        attempts: list[tuple[int, T, float, Optional[BaseException]]] = []

        for attempt in range(1, max_retries + 1):
            result, penalty, error = await callback(attempt, max_retries)

            if error is None:
                logger.info(f"'Retryable task' succeeded after {attempt} attempts.")
                return result, penalty, error

            attempts.append((attempt, result, penalty, error))
            errors = []
            if isinstance(error, ExceptionGroup):
                errors = error.exceptions
            elif error:
                errors = [error]
            error_messages = '\n    -'.join(str(e) for e in errors)
            logger.warning(f"'Retry task' attempt {attempt} failed with errors (penalty={penalty}):"
                           f"{error_messages}")

        # All attempts failed — pick the highest penalty fallback
        best_attempt, best_result, best_penalty, best_error = min(attempts, key=lambda x: x[2])

        errors = []
        if isinstance(best_error, ExceptionGroup):
            errors = best_error.exceptions
        elif best_error:
            errors = [best_error]
        error_messages = '\n    -'.join(str(e) for e in errors)
        logger.warning(f"'Retry task' failed after {max_retries} attempts. Using fallback result {best_attempt} (penalty={best_penalty}) with errors:"
                       f"{error_messages}")

        return best_result, best_penalty, best_error
