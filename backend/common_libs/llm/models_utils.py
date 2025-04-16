import logging
import os
from abc import ABC, abstractmethod

import vertexai

from dotenv import load_dotenv
from pydantic import BaseModel
from vertexai.generative_models import HarmCategory, HarmBlockThreshold, SafetySetting

from common_libs.retry import RetryConfig, DEFAULT_RETRY_CONFIG, Retry

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

DEFAULT_GENERATION_CONFIG = {
    "temperature": 0.1,
    "candidate_count": 1,
    "top_p": 0.95,
}

ZERO_TEMPERATURE_GENERATION_CONFIG = {
    "temperature": 0.0,
    "candidate_count": 1,
    "top_p": 0.95,
}

LOW_TEMPERATURE_GENERATION_CONFIG = {
    "temperature": 0.1,
    "candidate_count": 1,
    "top_p": 0.95,
}

MODERATE_TEMPERATURE_GENERATION_CONFIG = {
    "temperature": 0.25,
    "candidate_count": 1,
    "top_p": 0.95,
}

MEDIUM_TEMPERATURE_GENERATION_CONFIG = {
    "temperature": 0.5,
    "candidate_count": 1,
    "top_p": 0.95,
}

HIGH_TEMPERATURE_GENERATION_CONFIG = {
    "temperature": 1.0,
    "candidate_count": 1,
    "top_p": 0.95,
}

CRAZY_TEMPERATURE_GENERATION_CONFIG = {
    "temperature": 2.0,
    "candidate_count": 1,
    "top_p": 0.95,
}

JSON_GENERATION_CONFIG = {
    "response_mime_type": "application/json",
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
    # language_model_name: str = "gemini-1.5-flash-001"
    language_model_name: str = "gemini-2.0-flash-lite-001"
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

    @abstractmethod
    async def internal_generate_content(self, llm_input: LLMInput | str) -> LLMResponse:
        raise NotImplementedError()
