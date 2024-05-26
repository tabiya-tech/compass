import asyncio
import logging
import os
import random
from typing import Callable, TypeVar, Coroutine, Any, Generic
from abc import ABC, abstractmethod

import vertexai

from dotenv import load_dotenv
from google.api_core.exceptions import ResourceExhausted
from pydantic import BaseModel
from vertexai.generative_models import HarmCategory, HarmBlockThreshold, SafetySetting

logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

# Initialize the default region for the Vertex AI client

DEFAULT_VERTEX_API_REGION = os.getenv("VERTEX_API_REGION")
if not DEFAULT_VERTEX_API_REGION:
    logging.warning("Default Vertex AI region is not set. Using 'us-central1' as the default region.")
    DEFAULT_VERTEX_API_REGION = "us-central1"
else:
    logging.debug("Default Vertex AI region is %s", DEFAULT_VERTEX_API_REGION)

# Retry logic with exponential backoff and jitter #

T = TypeVar('T', bound=BaseModel)


class RetryConfig(BaseModel):
    """
    Configuration for retry logic with exponential backoff and jitter.
    """
    max_retries: int = 5  # number of retries
    initial_wait: float = 1.0  # in seconds
    base_backoff_factor: float = 2  # For exponential backoff it should be greater than 1 + jitter
    jitter: float = 0.5  # between 0 and 1


DEFAULT_RETRY_CONFIG = RetryConfig()


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
    async def call_with_exponential_backoff(callback: Callable[[], Coroutine[Any, Any, T]],
                                                  retry_config: RetryConfig = DEFAULT_RETRY_CONFIG) -> T:
        """ Call `callback()` with exponential backoff and jitter."""
        wait_time = retry_config.initial_wait
        for attempt in range(retry_config.max_retries):
            try:
                result: T = await callback()
                logger.debug("Attempt %d to call %s succeeded", attempt + 1, callback.__name__)
                return result
            except ResourceExhausted as e:
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


DEFAULT_GENERATION_CONFIG = {
        "temperature": 0.1,
        "candidate_count": 1,
}

ZERO_TEMPERATURE_GENERATION_CONFIG = {
        "temperature": 0.0,
        "candidate_count":1,
}

LOW_TEMPERATURE_GENERATION_CONFIG = {
        "temperature":0.1,
        "candidate_count":1
}

MEDIUM_TEMPERATURE_GENERATION_CONFIG = {
        "temperature":0.5,
        "candidate_count":1,
}

HIGH_TEMPERATURE_GENERATION_CONFIG = {
        "temperature":1.0,
        "candidate_count":1,
}

CRAZY_TEMPERATURE_GENERATION_CONFIG = {
        "temperature":2.0,
        "candidate_count":1,
}

# Todo(apostolos): Specify the safety settings after we have some relevant tests
DEFAULT_SAFETY_SETTINGS: frozenset[SafetySetting] = frozenset([
        SafetySetting(category=SafetySetting.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                      threshold=SafetySetting.HarmBlockThreshold.BLOCK_ONLY_HIGH),
        SafetySetting(category=HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                      threshold=HarmBlockThreshold.BLOCK_ONLY_HIGH),
        SafetySetting(category=HarmCategory.HARM_CATEGORY_HARASSMENT,
                      threshold=HarmBlockThreshold.BLOCK_ONLY_HIGH),
        SafetySetting(category=HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                      threshold=HarmBlockThreshold.BLOCK_ONLY_HIGH),
        SafetySetting(category=HarmCategory.HARM_CATEGORY_UNSPECIFIED,
                      threshold=HarmBlockThreshold.BLOCK_ONLY_HIGH),
])

SAFETY_OFF_SETTINGS: frozenset[SafetySetting] = frozenset([
        SafetySetting(category=HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                      threshold=HarmBlockThreshold.BLOCK_NONE),
        SafetySetting(category=HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                      threshold=HarmBlockThreshold.BLOCK_NONE),
        SafetySetting(category=HarmCategory.HARM_CATEGORY_HARASSMENT,
                      threshold=HarmBlockThreshold.BLOCK_NONE),
        SafetySetting(category=HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                      threshold=HarmBlockThreshold.BLOCK_NONE),
        SafetySetting(category=HarmCategory.HARM_CATEGORY_UNSPECIFIED,
                      threshold=HarmBlockThreshold.BLOCK_NONE),
])


class LLMConfig(BaseModel):
    """
    Configuration for the LLM.
    """
    # gemini-1.5-flash is an auto update version the points to the most recent stable version
    # see https://cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versioning#auto-updated-version
    model_name: str = "gemini-1.5-flash"
    location: str = DEFAULT_VERTEX_API_REGION
    generation_config: dict = DEFAULT_GENERATION_CONFIG
    safety_settings: frozenset[SafetySetting] = DEFAULT_SAFETY_SETTINGS
    retry_config: RetryConfig = DEFAULT_RETRY_CONFIG

    class Config:
        """
        Configuration settings for the LLMConfig model.
        """
        arbitrary_types_allowed = True
        """
        Allow arbitrary types for the model as the generation_config is a custom class.
        """


class LLMTurn(BaseModel):
    """
    A conversation turn to be used by the LLM
    """
    content: str
    role: str


class LLMInput(BaseModel):
    """
    Input for the LLM.
    """
    turns: list[LLMTurn]


class LLMResponse(BaseModel):
    """
    Response from the LLM.
    """
    text: str
    """The generated text."""
    prompt_token_count: int
    """The number of tokens in the prompt."""
    response_token_count: int
    """The number of tokens in the response."""



class LLM(ABC):
    """
    An abstract class for a LLM.
    """

    @abstractmethod
    async def generate_content(self, llm_input: LLMInput | str) -> LLMResponse:
        """
        Wrapper for the asynchronous `generate_content` method of `GenerativeModel`, `predict` of 'TextGenerationModel'
        and 'send_message' of 'ChatModel' and 'GenerativeModel'.
        that provides retry logic with exponential backoff.
        :param llm_input: Either a LLMInput object for chat, or a string for general generative content.
        :return: The generated response as a "model" with .
        """
        raise NotImplementedError()


class BasicLLM(LLM):
    def __init__(self, *, config: LLMConfig = LLMConfig()):
        # Before constructing the llm model, we need to initialize the VertexAI client
        # as the init function may have been called in another module with different parameters
        vertexai.init(location=config.location)
        self._retry_config = config.retry_config
        self._model = None
        self._chat = None
        self._resource_name = ""

    async def generate_content(self, llm_input: LLMInput | str) -> LLMResponse:
        async def _generate_content() -> LLMResponse:
            try:
                logger.debug("Generating content with resource:%s",
                             self._resource_name)

                return await self.internal_generate_content(llm_input)

            except Exception as e:
                logger.error("An error occurred while generating content with resource:%s",
                             self._resource_name, exc_info=True)
                raise e

        return await Retry[str].call_with_exponential_backoff(_generate_content)

    async def internal_generate_content(self, llm_input: LLMInput | str) -> LLMResponse:
        raise NotImplementedError()

