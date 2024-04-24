import logging
from abc import ABC, abstractmethod

from app.agent.agent_types import AgentInput, AgentOutput, AgentType
from app.agent.prompt_reponse_template import ModelResponse
from app.conversation_memory.conversation_formatter import ConversationHistoryFormatter
from app.conversation_memory.conversation_memory_manager import ConversationHistory

from common_libs.llm.gemini import GeminiGenerativeLLM, LLMConfig
from common_libs.text_formatters.extract_json import extract_json, ExtractJSONError


class Agent(ABC):
    """
    An abstract class for an agent.
    """

    @abstractmethod
    async def execute(self, user_input: AgentInput, history: ConversationHistory) -> AgentOutput:
        """
        Execute the agent's task given the user input and the conversation history
        :param user_input: The user input
        :param history: The conversation history
        :return: The agent output
        """
        raise NotImplementedError()


class SimpleLLMAgent(Agent):

    def __init__(self, *, agent_type: AgentType, system_instructions: str, config: LLMConfig = LLMConfig()):
        self._agent_type = agent_type
        self._system_instructions = system_instructions
        self._llm = GeminiGenerativeLLM(config=config)
        self._logger = logging.getLogger(__name__)

    async def execute(self, user_input: AgentInput, history: ConversationHistory) -> AgentOutput:
        model_input = self._system_instructions + "\n" + ConversationHistoryFormatter.format_for_prompt(
            history) + "\nUser: " + user_input.message
        llm_response = await self._llm.generate_content_async(model_input)
        try:
            last: ModelResponse = extract_json(llm_response, ModelResponse)
        except ExtractJSONError:
            self._logger.warning("Error extracting JSON from conversation content '%s'", llm_response, exc_info=True)
            last = ModelResponse(message=str(llm_response), finished=False)

        response = AgentOutput(message_for_user=last.message,
                               finished=last.finished,
                               agent_type=self._agent_type)
        return response
