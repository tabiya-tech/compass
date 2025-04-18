import asyncio
import logging
import random
from typing import TypeVar, Generic, Callable, Coroutine, Any, Type

from google.api_core.exceptions import ServerError, TooManyRequests, ResourceExhausted
from google.cloud.aiplatform_v1 import GenerationConfig
from pydantic import BaseModel


logger = logging.getLogger(__name__)

# Retry logic with exponential backoff and jitter #
T = TypeVar('T')


class RetryConfig(BaseModel):
    """
    Configuration for retry logic with exponential backoff and jitter.
    """
    max_retries: int = 5  # number of retries
    initial_wait: float = 1.0  # in seconds
    base_backoff_factor: float = 2  # For exponential backoff it should be greater than 1 + jitter
    jitter: float = 0.5  # between 0 and 1


class TemperatureRetryConfig(BaseModel):
    """
    Configuration for retry logic with temperature adjustment.
    """
    max_retries: int = 3  # number of retries
    temperature_step: float = 0.1  # how much to increase temperature by each retry
    max_temperature: float = 1.0  # maximum temperature to reach


DEFAULT_RETRY_CONFIG = RetryConfig()
DEFAULT_TEMPERATURE_RETRY_CONFIG = TemperatureRetryConfig()


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
    
class _RetryTriggeredException(Exception):
    """Internal exception used to signal a retry."""
    pass


class Retry(Generic[T]):
    """
    A generic class for retry logic with exponential backoff and jitter.
    """

    @staticmethod
    async def call_with_exponential_backoff(callback: Callable[[], Coroutine[Any, Any, T]],
                                            retry_config: RetryConfig = DEFAULT_RETRY_CONFIG) -> T:
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
    async def call_with_temperature_adjustment(
        callback: Callable[[Callable[[str], None]], Coroutine[Any, Any, T]],
        generation_config: GenerationConfig,
        retry_config: TemperatureRetryConfig = DEFAULT_TEMPERATURE_RETRY_CONFIG,
        logger: logging.Logger = logger
    ) -> T:
        """
        Call `callback()` with temperature adjustment retries.
        The callback is passed a retry function that it can call to signal a retry.
        If all attempts fail but we have a result, we will log an error and continue with that result.
        
        Args:
            callback: The async function to call. Takes a retry function as its only argument.
            generation_config: The generation config containing the temperature setting
            retry_config: Configuration for temperature adjustment retries
            logger: Logger to use for logging retry attempts
        
        Returns:
            The result of the callback if we have one, even if all attempts failed
        """
        original_temperature = generation_config.temperature
        result = None
        attempt = 0

        def retry(message: str) -> None:
            nonlocal attempt
            if attempt < retry_config.max_retries - 1:
                current_temperature = generation_config.temperature
                new_temperature = min(
                    current_temperature + retry_config.temperature_step,
                    retry_config.max_temperature
                )
                generation_config.temperature = new_temperature
                logger.warning(
                    f"Attempt {attempt + 1} signaled retry: {message}. "
                    f"Adjusting temperature from {current_temperature} to {new_temperature} and retrying."
                )
                raise _RetryTriggeredException()
            else:
                logger.error(
                    f"Final attempt signaled retry: {message}. "
                    f"Proceeding with potentially incorrect results."
                )

        try:
            while attempt < retry_config.max_retries:
                try:
                    result = await callback(retry)
                    break
                except _RetryTriggeredException:
                    attempt += 1
                    continue
                except Exception as e:
                    logger.error(f"Retry {attempt + 1} failed: {str(e)}")
                    break
        finally:
            # Always reset temperature to original value
            generation_config.temperature = original_temperature

        if result is None:
            raise RetryLimitExceededError(retries=retry_config.max_retries)

        return result
