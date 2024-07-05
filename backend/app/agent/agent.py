import logging

from abc import ABC, abstractmethod
from typing import Generic, TypeVar

from app.agent.agent_types import AgentInput, AgentOutput, AgentType
from app.agent.llm_caller import LLMCaller
from app.agent.prompt_response_template import get_json_response_instructions

from app.conversation_memory.conversation_memory_manager import ConversationContext
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, LOW_TEMPERATURE_GENERATION_CONFIG, JSON_GENERATION_CONFIG


class Agent(ABC):
    """
    An abstract class for an agent.

    Implementations of this class that are responsible for the conversation history, should have access to the
    conversation manager and handle the conversation history themselves.
    Otherwise, their owner should handle the conversation history.
    """

    def __init__(self, *, agent_type: AgentType, is_responsible_for_conversation_history: bool = False):
        self._agent_type = agent_type
        self._is_responsible_for_conversation_history = is_responsible_for_conversation_history

    def is_responsible_for_conversation_history(self) -> bool:
        """
        Check if the agent is responsible for the conversation history
        """
        return self._is_responsible_for_conversation_history

    @property
    def agent_type(self) -> AgentType:
        return self._agent_type

    @abstractmethod
    async def execute(self, user_input: AgentInput, context: ConversationContext) -> AgentOutput:
        """
        Execute the agent's task given the user input and the conversation history
        :param user_input: The user input
        :param context: The conversation context
        :return: The agent output
        """
        raise NotImplementedError()


P = TypeVar('P')


class SimpleLLMAgent(Agent, Generic[P]):
    """
    This is a simple stateless agent that uses the GeminiGenerativeLLM to respond to the user input in a conversation.
    """

    def __init__(self, *, agent_type: AgentType, system_instructions: str,
                 config: LLMConfig = LLMConfig(
                     generation_config=LOW_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG)):
        super().__init__(agent_type=agent_type, is_responsible_for_conversation_history=False)
        self._llm_config = config
        self._system_instructions = system_instructions
        # We should pass the system instructions to the LLM
        # Passing the system instructions as a user part manually in the content,
        # does not seem to work well with the model as it does follow the instructions correctly.
        self._llm = GeminiGenerativeLLM(system_instructions=system_instructions, config=config)
        self._logger = logging.getLogger(self.__class__.__name__)
        self._llm_caller = LLMCaller[P]()

    def get_model_response_instructions(self):
        """
        Return the instructions for the response that will be added at the end of the conversation as an additional
        user input to reinforce that the model should respond with a JSON object.
        See ConversationHistoryFormatter.format_for_agent_generative_prompt() for additional information

        Agents that return a custom data type should override this method to provide the correct instructions.
        :return: The instructions
        """
        # typical implementation would be
        return get_json_response_instructions()

    async def execute(self, user_input: AgentInput, context: ConversationContext) -> AgentOutput[P]:
        return await self._llm_caller.call_llm_agent(
            llm=self._llm,
            agent_type=self._agent_type,
            model_response_instructions=self.get_model_response_instructions(),
            user_input=user_input,
            context=context,
            logger=self._logger)
