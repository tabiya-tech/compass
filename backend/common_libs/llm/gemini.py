import asyncio
import logging
import os
import random
import time
from typing import Callable, TypeVar, Coroutine, Any, Generic

import vertexai
from dotenv import load_dotenv
from google.api_core.exceptions import ResourceExhausted
from pydantic import BaseModel, validator
from vertexai.generative_models import GenerativeModel, Content, HarmCategory, HarmBlockThreshold, GenerationConfig, \
    SafetySetting

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
    async def call_with_exponential_backoff_async(callback: Callable[[], Coroutine[Any, Any, T]],
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
                wait_time *= Retry._get_random_wait_time(wait_time, retry_config.base_backoff_factor,
                                                         retry_config.jitter)
            # rethrow other exceptions
            except Exception as e:
                logger.error("An error occurred", exc_info=True)
                raise e
        raise RetryLimitExceededError(retries=retry_config.max_retries)

    @staticmethod
    def call_with_exponential_backoff(callback: Callable[[], T],
                                      retry_config: RetryConfig = RetryConfig()) -> T:
        """ Call `callback()` with exponential backoff and jitter."""
        wait_time = retry_config.initial_wait
        for attempt in range(retry_config.max_retries):
            try:
                result: T = callback()
                logger.debug("Attempt %d to call %s succeeded", attempt + 1, callback.__name__)
                return result
            except ResourceExhausted as e:
                logger.warning("Attempt %d to call %s failed, error: %s, retrying in %.2f seconds", attempt + 1,
                               callback.__name__, e, wait_time)
                time.sleep(wait_time)
                wait_time *= Retry._get_random_wait_time(wait_time, retry_config.base_backoff_factor,
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


###### GeminiLLM Wrapper ######

DEFAULT_GENERATION_CONFIG = GenerationConfig(
    temperature=0.1,
    candidate_count=1,
)

ZERO_TEMPERATURE_GENERATION_CONFIG = GenerationConfig(
    temperature=0.0,
    candidate_count=1,
)

LOW_TEMPERATURE_GENERATION_CONFIG = GenerationConfig(
    temperature=0.1,
    candidate_count=1,
)

MEDIUM_TEMPERATURE_GENERATION_CONFIG = GenerationConfig(
    temperature=0.5,
    candidate_count=1,
)

HIGH_TEMPERATURE_GENERATION_CONFIG = GenerationConfig(
    temperature=1.0,
    candidate_count=1,
)

CRAZY_TEMPERATURE_GENERATION_CONFIG = GenerationConfig(
    temperature=2.0,
    candidate_count=1,
)

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
    Configuration for the Gemini LLM.
    """
    # gemini-1.0-pro is an auto update version the points to the most recent stable version
    # see https://cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versioning#auto-updated-version
    model_name: str = "gemini-1.0-pro"
    location: str = DEFAULT_VERTEX_API_REGION
    generation_config: GenerationConfig = DEFAULT_GENERATION_CONFIG
    safety_settings: frozenset[SafetySetting] = DEFAULT_SAFETY_SETTINGS
    retry_config: RetryConfig = DEFAULT_RETRY_CONFIG

    # Define a custom validator
    @validator('generation_config', pre=True, allow_reuse=True)
    def _validate_generation_config_field(cls, value):
        if not isinstance(value, GenerationConfig):
            raise ValueError("Invalid type for generation_config")
        return value

    class Config:
        """
        Configuration settings for the LLMConfig model.
        """
        arbitrary_types_allowed = True
        """
        Allow arbitrary types for the model as the generation_config is a custom class.
        """


class GeminiChatLLM:
    """
    A wrapper for the Gemini LLM that includes retry logic with exponential backoff and jitter
    for sending messages in a chat session. The Gemini LLM chat session is stateful and maintains an in-memory history.
    Essentially, the chat uses the same underlying model as the generative model.
    It constructs the content by using ´system_instructions´, ´history´ and ´message´ as inputs,
    which are then processed by the ´generate_content()´ function to generate the desired output.
    """

    def __init__(self,
                 *,
                 system_instructions: list[str] | str,
                 history: list[Content] = None,
                 config: LLMConfig = LLMConfig()):
        # Before constructing the GenerativeModel, we need to initialize the VertexAI client
        # as the init function may have been called in another module with different parameters
        vertexai.init(location=config.location)
        self._model = GenerativeModel(model_name=config.model_name,
                                      system_instruction=system_instructions,
                                      generation_config=config.generation_config,
                                      safety_settings=list(config.safety_settings)
                                      )
        self._chat = self._model.start_chat(history=history)
        self._retry_config = config.retry_config

    async def send_message_async(self, message: str, ) -> str:
        """
        Chat using the Gemini LLM.
        Wrapper for the asynchronous `send_message_async` method of `GenerativeModel`
        that provides retry logic with exponential backoff.
        :param message: The message to send as a "user".
        :return: The generated response as a "model".
        """

        async def _send_message_async() -> str:
            try:
                # noinspection PyProtectedMember
                logger.debug("Sending message via chat to resource:%s",
                             self._model._prediction_resource_name)  # pylint: disable=protected-access
                response = await self._chat.send_message_async(message, stream=False)
                return response.text
            except Exception as e:
                # noinspection PyProtectedMember
                logger.error("An error occurred while sending a message in the chat to resource:%s",
                             self._model._prediction_resource_name, exc_info=True)  # pylint: disable=protected-access
                raise e

        return await Retry[str].call_with_exponential_backoff_async(_send_message_async, self._retry_config)

    def send_message(self, message: str) -> str:
        """
        Chat using the Gemini LLM.
        Wrapper for the synchronous `send_message` method of `GenerativeModel`
        that provides retry logic with exponential backoff.
        :param message: The message to send as a "user".
        :return: The generated response as a "model".
        """

        def _send_message() -> str:
            try:
                # noinspection PyProtectedMember
                logger.debug("Sending message via chat to resource:%s",
                             self._model._prediction_resource_name)  # pylint: disable=protected-access
                response = self._chat.send_message(message, stream=False)
                return response.text
            except Exception as e:
                # noinspection PyProtectedMember
                logger.error("An error occurred while sending a message in the chat to resource:%s",
                             self._model._prediction_resource_name, exc_info=True)  # pylint: disable=protected-access
                raise e

        return Retry[str].call_with_exponential_backoff(_send_message, self._retry_config)


class GeminiGenerativeLLM:
    """
    A wrapper for the Gemini LLM that provides retry logic with exponential backoff and jitter for generating content.
    """

    def __init__(self, *,
                 system_instructions: list[str] | str | None = None,
                 config: LLMConfig = LLMConfig()):
        # Before constructing the GenerativeModel, we need to initialize the VertexAI client
        # as the init function may have been called in another module with different parameters
        vertexai.init(location=config.location)
        self._model = GenerativeModel(model_name=config.model_name,
                                      system_instruction=system_instructions,
                                      generation_config=config.generation_config,
                                      safety_settings=list(config.safety_settings)
                                      )
        self._retry_config = config.retry_config

    async def generate_content_async(self, contents: list[Content] | str) -> str:
        """
        Generate content using the Gemini LLM.
        Wrapper for the asynchronous `generate_content_async` method of `GenerativeModel`
        that provides retry logic with exponential backoff.
        :param contents: Either a list of `Content` objects for chat, or a string for general generative content.
        :return: The generated content.
        """

        async def _generate_content_async() -> str:
            try:
                # noinspection PyProtectedMember
                logger.debug("Generating content with resource:%s",
                             self._model._prediction_resource_name)  # pylint: disable=protected-access
                response = await self._model.generate_content_async(contents=contents)
                return response.text
            except Exception as e:
                # noinspection PyProtectedMember
                logger.error("An error occurred while generating content with resource:%s",
                             self._model._prediction_resource_name, exc_info=True)  # pylint: disable=protected-access
                raise e

        return await Retry[str].call_with_exponential_backoff_async(_generate_content_async)

    async def generate_content(self, contents: list[Content] | str) -> str:
        """
        Generate content using the Gemini LLM.
        Wrapper for the synchronous `generate_content` method of `GenerativeModel`
        that provides retry logic with exponential backoff.
        :param contents: Either a list of `Content` objects for chat, or a string for general generative content.
        :return: The generated content.
        """

        def _generate_content() -> str:
            try:
                # noinspection PyProtectedMember
                logger.debug("Generating content with resource:%s",
                             self._model._prediction_resource_name)  # pylint: disable=protected-access
                response = self._model.generate_content(contents=contents)
                return response.text
            except Exception as e:
                # noinspection PyProtectedMember
                logger.error("An error occurred while generating content with resource:%s",
                             self._model._prediction_resource_name, exc_info=True)  # pylint: disable=protected-access
                raise e

        return await Retry[str].call_with_exponential_backoff(_generate_content)


class GeminiStatelessChatLLM:
    """
    A wrapper for the Gemini LLM that includes retry logic with exponential backoff and jitter
    for sending messages in a stateless chat session which is created and destroyed for each message.

    """

    def __init__(self,
                 *,
                 system_instructions: list[str] | str,
                 config: LLMConfig = LLMConfig()):
        # Before constructing the GenerativeModel, we need to initialize the VertexAI client
        # as the init function may have been called in another module with different parameters
        vertexai.init(location=config.location)
        self._model = GenerativeModel(model_name=config.model_name,
                                      system_instruction=system_instructions,
                                      generation_config=config.generation_config,
                                      safety_settings=list(config.safety_settings)
                                      )
        self._retry_config = config.retry_config

    async def send_message_async(self, *, history: list[Content], message: str,
                                 generation_config: GenerationConfig = None) -> str:
        """
        Chat using the Gemini LLM.
        It creates a new temporary chat session for each message,
        sends the message and returns the response from the model.
        It also includes retry logic with exponential backoff and jitter.
        :param generation_config: Optionally specify a different generation config for the message. This is useful
        for example when you want to use a different temperature for a specific message.
        :param history: The history of the conversation.
        :param message: The message to send as a "user".
        :return: The generated response as a "model".
        """

        chat = self._model.start_chat(history=history)

        async def _send_message_async() -> str:
            try:
                # noinspection PyProtectedMember
                logger.debug("Sending message via chat to resource:%s",
                             self._model._prediction_resource_name)  # pylint: disable=protected-access
                response = await chat.send_message_async(message, generation_config=generation_config, stream=False)
                return response.text
            except Exception as e:
                # noinspection PyProtectedMember
                logger.error("An error occurred while sending a message in the chat to resource:%s",
                             self._model._prediction_resource_name, exc_info=True)  # pylint: disable=protected-access
                raise e

        return await Retry[str].call_with_exponential_backoff_async(_send_message_async, self._retry_config)
