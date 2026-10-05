import logging
from typing import Type

from pydantic import BaseModel

from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, LLMInput, LLMResponse, LLMTurn

logger = logging.getLogger(__name__)


class GeminiChatLLM(GeminiGenerativeLLM):
    """
    A wrapper for the Gemini LLM for sending messages in a chat session.
    The chat session is stateful and maintains an in-memory history: every message is sent with the history of the
    conversation, and the message and the response of the model are then added to the history.
    """

    def __init__(self,
                 *,
                 system_instructions: list[str] | str,
                 llm_input: LLMInput = None,
                 config: LLMConfig = LLMConfig()):
        """
        :param system_instructions: The system instructions of the model.
        :param llm_input: The history to start the chat session with.
        :param config: The configuration of the LLM.
        """
        super().__init__(system_instructions=system_instructions, config=config)
        self._history: list[LLMTurn] = [] if llm_input is None else list(llm_input.turns)

    async def generate_content(self, llm_input: LLMInput | str,
                               response_schema: Type[BaseModel] | None = None) -> LLMResponse:
        new_turns = [LLMTurn(role="user", content=llm_input)] if isinstance(llm_input, str) else list(llm_input.turns)
        response = await super().generate_content(LLMInput(turns=self._history + new_turns), response_schema)
        self._history.extend(new_turns)
        self._history.append(LLMTurn(role="model", content=response.text))
        return response
