import asyncio
import logging
from typing import Any, Type

from google import genai
from pydantic import BaseModel

from common_libs.llm.models_utils import LLMConfig, LLMInput, LLMResponse, BasicLLM, get_response_schema

logger = logging.getLogger(__name__)

_GENERATION_PARAMETERS = ("temperature", "top_p", "max_output_tokens", "seed", "stop_sequences")
"""The generation parameters supported by the Interactions API, the other keys of a generation config are ignored."""

_ROLE_TO_STEP_TYPE = {
    "user": "user_input",
    "model": "model_output",
}

_clients: dict[tuple[str, int], genai.Client] = {}


def get_genai_client(location: str) -> genai.Client:
    """
    Get the google-genai client for Vertex AI in the given location.
    The project and the credentials are taken from the environment (GOOGLE_APPLICATION_CREDENTIALS).

    A client is kept per location and per event loop, as its async sessions are bound to the event loop they were
    created in.
    """
    try:
        loop_id = id(asyncio.get_running_loop())
    except RuntimeError:
        loop_id = 0
    key = (location, loop_id)
    client = _clients.get(key)
    if client is None:
        client = genai.Client(vertexai=True, location=location)
        _clients[key] = client
    return client


def llm_input_to_interactions_input(llm_input: LLMInput | str) -> str | list[dict[str, Any]]:
    """
    Convert the input to the input of the Interactions API: a string, or the conversation turns as steps.
    The conversation history is always sent with the input (stateless), it is not stored on the server.

    The API rejects an empty text, so an empty input is sent as a blank text, and a turn with an empty content
    as a step without content (which keeps the order of the turns).
    """
    if isinstance(llm_input, str):
        return llm_input if llm_input else " "
    steps: list[dict[str, Any]] = []
    for turn in llm_input.turns:
        step: dict[str, Any] = {"type": _ROLE_TO_STEP_TYPE.get(turn.role, "user_input")}
        if turn.content:
            step["content"] = [{"type": "text", "text": turn.content}]
        steps.append(step)
    return steps


def response_format_for(generation_config: dict, response_schema: Type[BaseModel] | None) -> dict[str, Any] | None:
    """
    The response format of the Interactions API for the structured output, or None for plain text.
    """
    if response_schema is not None:
        return {"type": "text", "mime_type": "application/json", "schema": response_schema.model_json_schema()}
    if generation_config.get("response_mime_type") == "application/json":
        return {"type": "text", "mime_type": "application/json"}
    return None


class GeminiGenerativeLLM(BasicLLM):
    """
    A wrapper for the Gemini LLM, on the google-genai Interactions API of Vertex AI,
    that provides retry logic with exponential backoff and jitter for generating content.
    """

    def __init__(self, *,
                 system_instructions: list[str] | str | None = None,
                 config: LLMConfig = LLMConfig()):
        super().__init__(config=config)
        self._system_instruction = "\n".join(system_instructions) if isinstance(system_instructions, list) else system_instructions
        self._safety_settings = [dict(setting) for setting in config.safety_settings]
        self._location = config.location
        self._resource_name = f"locations/{config.location}/publishers/google/models/{self._model_name}"

    async def internal_generate_content(self, llm_input: LLMInput | str,
                                        response_schema: Type[BaseModel] | None = None) -> LLMResponse:
        request: dict[str, Any] = {
            "model": self._model_name,
            "input": llm_input_to_interactions_input(llm_input),
            "generation_config": {key: value for key, value in self.generation_config.items() if key in _GENERATION_PARAMETERS},
            "safety_settings": self._safety_settings,
            "store": False,
        }
        if self._system_instruction:
            request["system_instruction"] = self._system_instruction
        response_format = response_format_for(self.generation_config, get_response_schema(self.generation_config, response_schema))
        if response_format is not None:
            request["response_format"] = response_format

        interaction = await get_genai_client(self._location).aio.interactions.create(**request)
        usage = interaction.usage
        return LLMResponse(
            text=interaction.output_text or "",
            prompt_token_count=(usage.total_input_tokens or 0) if usage else 0,
            response_token_count=(usage.total_output_tokens or 0) if usage else 0,
        )
