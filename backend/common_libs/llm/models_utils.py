import logging
import os
from abc import ABC, abstractmethod
from typing import Type

from dotenv import load_dotenv
from pydantic import BaseModel

from app.agent.config import AgentsConfig
from common_libs.observability.tracing import traced_observation, update_observation
from common_libs.retry import RetryConfigWithExponentialBackOff, DEFAULT_RETRY_CONFIG_WITH_EXP_BACKOFF, Retry

logger = logging.getLogger(__name__)

# Load environment variables from .env file
load_dotenv()

# The default Vertex AI location of the generative-AI client.
# Embeddings use a separate region (VERTEX_API_EMBEDDINGS_REGION) — see GoogleEmbeddingService.

DEFAULT_VERTEX_API_GEN_AI_REGION = os.getenv("VERTEX_API_GEN_AI_REGION")
if not DEFAULT_VERTEX_API_GEN_AI_REGION:
    logging.warning("VERTEX_API_GEN_AI_REGION is not set. Using 'us-central1' as the default region.")
    DEFAULT_VERTEX_API_GEN_AI_REGION = "us-central1"
else:
    logging.info("Default Vertex AI gen-AI region is %s", DEFAULT_VERTEX_API_GEN_AI_REGION)

DEFAULT_GENERATION_CONFIG = {
    "temperature": 0.1,
    "top_p": 0.95,
}

ZERO_TEMPERATURE_GENERATION_CONFIG = {
    "temperature": 0.0,
    "top_p": 0.95,
}

LOW_TEMPERATURE_GENERATION_CONFIG = {
    "temperature": 0.1,
    "top_p": 0.95,
}

MODERATE_TEMPERATURE_GENERATION_CONFIG = {
    "temperature": 0.25,
    "top_p": 0.95,
}

MEDIUM_TEMPERATURE_GENERATION_CONFIG = {
    "temperature": 0.5,
    "top_p": 0.95,
}

HIGH_TEMPERATURE_GENERATION_CONFIG = {
    "temperature": 1.0,
    "top_p": 0.95,
}

CRAZY_TEMPERATURE_GENERATION_CONFIG = {
    "temperature": 2.0,
    "top_p": 0.95,
}

JSON_GENERATION_CONFIG = {
    "response_mime_type": "application/json",
}

_HARM_CATEGORIES = ("dangerous_content", "sexually_explicit", "harassment", "hate_speech")
"""The harm categories of the google-genai Interactions API safety settings."""

# Todo(apostolos): Specify the safety settings after we have some relevant tests
DEFAULT_SAFETY_SETTINGS: tuple[dict[str, str], ...] = tuple(
    {"type": category, "threshold": "block_only_high"} for category in _HARM_CATEGORIES)

SAFETY_OFF_SETTINGS: tuple[dict[str, str], ...] = tuple(
    {"type": category, "threshold": "block_none"} for category in _HARM_CATEGORIES)


def get_config_variation(
        start_temperature: float,
        end_temperature: float,
        start_top_p: float,
        end_top_p: float,
        attempt: int,
        max_retries: int
) -> dict:
    """
    Exponentially change temperature and top_p over retry attempts.
    The temperature and top_p are adjusted using a soft exponential curve to control the randomness and
    diversity of the model's responses.

    Typical is to start with a low temperature and top_p, and increase them with each retry attempt if the previous attempt failed.
    This allows the model to start with more focused responses and gradually increase the randomness and diversity.

    :param start_temperature: The starting temperature.
    :param end_temperature: The ending temperature.
    :param start_top_p: The starting top_p value.
    :param end_top_p: The ending top_p value.
    :param attempt: The current retry attempt.
    :param max_retries: The maximum number of retries.
    """
    progress = (attempt - 1) / max(max_retries - 1, 1)  # Normalize to [0, 1]
    exponent = 2  # Adjust curve steepness, 2 offer a soft exponential increase for 3–4 retries
    factor = progress ** exponent

    # Change temperature progressively to adjust randomness on each retry.
    # A soft exponential curve is used to smoothly transition between the starting and ending values,
    # helping control the level of diversity in the model’s responses across retries.
    temperature = round(start_temperature + (end_temperature - start_temperature) * factor, 2)

    # Adjust top_p progressively to control the range of tokens the LLM considers on each retry.
    # This gradual change helps balance variability and coherence, depending on how start and end are configured.
    # A soft exponential curve works well for 3–4 retries to shift the sampling behavior meaningfully but smoothly.
    top_p = round(start_top_p + (end_top_p - start_top_p) * factor, 2)

    return {
        "temperature": temperature,
        "top_p": top_p,
        }


class LLMConfig(BaseModel):
    """
    Configuration for the LLM.
    """
    language_model_name: str = AgentsConfig.default_model
    location: str = DEFAULT_VERTEX_API_GEN_AI_REGION
    generation_config: dict = DEFAULT_GENERATION_CONFIG
    """
    The generation parameters (temperature, top_p, max_output_tokens, ...). It may also carry the structured output
    of the response, see `common_libs.llm.schema_builder.with_response_schema`.
    """
    safety_settings: tuple[dict[str, str], ...] = DEFAULT_SAFETY_SETTINGS
    retry_config: RetryConfigWithExponentialBackOff = DEFAULT_RETRY_CONFIG_WITH_EXP_BACKOFF

    class Config:
        """
        Configuration settings for the LLMConfig model.
        """
        arbitrary_types_allowed = True
        """
        Allow arbitrary types, as the generation_config may carry the pydantic class of the response schema.
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
    async def generate_content(self, llm_input: LLMInput | str,
                               response_schema: Type[BaseModel] | None = None) -> LLMResponse:
        """
        Generate a response for the input, with retry logic with exponential backoff.
        :param llm_input: Either a LLMInput object for chat, or a string for general generative content.
        :param response_schema: The pydantic model the response must follow (structured output).
            When omitted, the response schema of the LLM's generation config is used, if any.
        :return: The generated response as a "model".
        """
        raise NotImplementedError()


def get_response_schema(generation_config: dict, response_schema: Type[BaseModel] | None = None) -> Type[BaseModel] | None:
    """
    Get the pydantic model of the structured output: the one given for the call, else the one of the generation config.
    """
    if response_schema is not None:
        return response_schema
    return generation_config.get("response_schema")


_TRACEABLE_GENERATION_PARAMETERS = ("temperature", "top_p", "max_output_tokens", "seed", "stop_sequences")
"""The generation parameters reported to the tracing backend."""


def llm_input_to_traceable(llm_input: LLMInput | str) -> str | list[dict]:
    """
    Render an LLM input as something a trace payload can carry.

    :param llm_input: The input to the LLM.
    :return: The raw string, or the turns as a list of role/content dicts.
    """
    if isinstance(llm_input, str):
        return llm_input
    return [{"role": turn.role, "content": turn.content} for turn in llm_input.turns]


class BasicLLM(LLM):
    def __init__(self, *, config: LLMConfig = LLMConfig()):
        self.logger = logging.getLogger(self.__class__.__name__)
        self._retry_config = config.retry_config
        self._resource_name = ""
        # Kept so that the observability layer can report which model and parameters produced a
        # generation. The concrete wrappers hand the same values to the underlying Vertex model.
        self._model_name = config.language_model_name
        # A copy, as the callers may adjust it between attempts (see `generation_config`).
        self._generation_config = dict(config.generation_config)

    @property
    def generation_config(self) -> dict:
        """
        The generation parameters used for every call. It is read at call time, so a caller can adjust it between
        attempts, e.g. to raise the temperature to escape a repetition trap.
        """
        return self._generation_config

    async def generate_content(self, llm_input: LLMInput | str,
                               response_schema: Type[BaseModel] | None = None) -> LLMResponse:
        async def _generate_content() -> LLMResponse:
            try:
                logger.debug("Generating content with resource:%s",
                             self._resource_name)

                return await self.internal_generate_content(llm_input, response_schema)

            except Exception as e:
                logger.error("An error occurred while generating content with resource:%s",
                             self._resource_name, exc_info=True)
                raise e

        # This is the single funnel for nearly every LLM call in the backend, which is why the
        # generation observation lives here rather than in each of the ~40 call sites.
        with traced_observation(
                name=f"{self.__class__.__name__}.generate_content",
                as_type="generation",
                input=llm_input_to_traceable(llm_input),
                model=self._model_name,
                model_parameters={key: value for key, value in self._generation_config.items()
                                  if key in _TRACEABLE_GENERATION_PARAMETERS},
                metadata={"resource_name": self._resource_name},
        ) as generation:
            try:
                response = await Retry[str].call_with_exponential_backoff(callback=_generate_content, logger=logger)
            except Exception as e:
                update_observation(generation, level="ERROR", status_message=str(e))
                raise

            update_observation(
                generation,
                output=response.text,
                usage_details={
                    "input": response.prompt_token_count,
                    "output": response.response_token_count,
                    "total": response.prompt_token_count + response.response_token_count,
                },
            )
            return response

    @abstractmethod
    async def internal_generate_content(self, llm_input: LLMInput | str,
                                        response_schema: Type[BaseModel] | None = None) -> LLMResponse:
        raise NotImplementedError()
