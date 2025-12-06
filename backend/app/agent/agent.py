# app/agent/agent.py -> Abstract base class that all agents must implement
import logging

from abc import ABC, abstractmethod

from app.agent.agent_types import AgentInput, AgentOutput, AgentType
from app.conversation_memory.conversation_memory_manager import ConversationContext


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
        self._logger = logging.getLogger(self.__class__.__name__)

    @property
    def logger(self):
        return self._logger

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
