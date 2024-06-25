import logging
from abc import ABC, abstractmethod
from typing import Generic, TypeVar

from pydantic import BaseModel

from app.agent.agent import Agent, LLMCaller
from app.agent.agent_types import AgentInput, AgentType, AgentOutput

from app.conversation_memory.conversation_memory_manager import ConversationContext
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig

# Define a generic type variable for the state
S = TypeVar('S', bound='AgentState')


class AgentState(BaseModel):
    """
    Abstract base class for all agent-specific states.
    """
    pass


P = TypeVar('P')


class StatefulAgent(Agent, ABC, Generic[S, P]):
    """
    An abstract class for a stateful agent.
    """

    def __init__(self, *, agent_type: AgentType, is_responsible_for_conversation_history,
                 config: LLMConfig = LLMConfig()):
        super().__init__(agent_type=agent_type,
                         is_responsible_for_conversation_history=is_responsible_for_conversation_history)
        self._agent_type = agent_type
        self._state: S | None = None
        self._logger = logging.getLogger(self.__class__.__name__)
        self._llm_caller = LLMCaller[P]()
        self._llm_config = config

    def get_state(self) -> S:
        """
        Get the agent's state.
        See set_state method for more information.
        :return: the agent's state
        """
        if self._state is None:
            raise ValueError("The agent state is not set")
        return self._state

    def set_state(self, state: S):
        """
        Set the agent's state.
        The agent's state is part of the application's state. The agent may mutate the state during execution,
        so developers should be conservative when sharing the state between agents
        as it may lead to unexpected behavior.
        If developers want to make state immutable, and operate on a copy of the state, they should override this method
        and use the get_state method to return a copy of the state that the agent operated on and mutated.
        It is up to the developer to ensure that the state is correctly set before calling the execute method.
        :param state: the agent's state
        """
        self._state = state

    async def execute(self, user_input: AgentInput, context: ConversationContext) -> AgentOutput[P]:
        """
        Execute the agent's task given the user input and the conversation history
        Subclasses should implement the get_stateful_system_instructions method
        to return the system instructions based on the agent's state.
        Additionally, subclasses should override this method if they need to implement more complex behavior.
        :param user_input:
        :param context:
        :return:
        """
        if self._state is None:
            raise ValueError("The agent state is not set")
        _llm = GeminiGenerativeLLM(system_instructions=self.get_stateful_system_instructions(), config=self._llm_config)
        return await self._llm_caller.call_llm_agent(
            llm=_llm,
            agent_type=self._agent_type,
            user_input=user_input,
            context=context,
            logger=self._logger)

    @abstractmethod
    def get_stateful_system_instructions(self) -> str:
        """
        Get the system instructions for the agent.
        Implement this method to return the system instructions for the agent based on the agent state.
        This method should be called after the agent state is set.
        :return: The system instructions for the agent
        """
        raise NotImplementedError()
