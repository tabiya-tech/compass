from abc import ABC, abstractmethod

from app.agent.agent_types import AgentInput, AgentOutput
from app.conversation_memory.conversation_memory_manager import ConversationHistory


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
