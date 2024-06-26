import logging

from abc import ABC, abstractmethod
from typing import Generic, TypeVar

from app.agent.agent_types import AgentInput, AgentOutput, AgentType
from app.agent.llm_caller import LLMCaller

from app.conversation_memory.conversation_memory_manager import ConversationContext
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, LOW_TEMPERATURE_GENERATION_CONFIG


class Agent(ABC):
    """
    An abstract class for an agent.
    """

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
                 config: LLMConfig = LLMConfig(generation_config=LOW_TEMPERATURE_GENERATION_CONFIG)):
        self._agent_type = agent_type
        self._llm_config = config
        self._system_instructions = system_instructions
        # We should pass the system instructions to the LLM
        # Passing the system instructions as a user part manually in the content,
        # does not seem to work well with the model as it does follow the instructions correctly.
        self._llm = GeminiGenerativeLLM(system_instructions=system_instructions, config=config)
        self._logger = logging.getLogger(self.__class__.__name__)
        self._llm_caller = LLMCaller[P]()

    # TODO: remove this as there is no need to expose the LLM config
    def get_llm_config(self):
        return self._llm_config

    async def execute(self, user_input: AgentInput, context: ConversationContext) -> AgentOutput[P]:
        return await self._llm_caller.call_llm_agent(
            llm=self._llm,
            agent_type=self._agent_type,
            user_input=user_input,
            context=context,
            logger=self._logger)
