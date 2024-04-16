from abc import ABC, abstractmethod
from enum import Enum
from typing import List, Tuple, TypeAlias, Optional

from pydantic import BaseModel


class AgentType(Enum):
    """
    An enumeration for agent types
    """
    WELCOME_AGENT = "WelcomeAgent"
    SKILL_EXPLORER_AGENT = "SkillExplorerAgent"
    FAREWELL_AGENT = "FarewellAgent"


class AgentInput(BaseModel):
    """
    The input to an agent
    """
    message: str  # Bad idea, rename


class AgentOutput(BaseModel):
    """
    The output of an agent
    """
    message_for_user: str
    finished: bool
    agent_type: Optional[AgentType] = None


ConversationHistory: TypeAlias = List[Tuple[AgentInput, AgentOutput]]


class ConversationHistoryFormatter:
    """
    A Formatter for conversation history
    """

    @staticmethod
    def format_for_prompt(history: ConversationHistory):
        """
        Format the conversation history in a suitable way to be appended to the prompt
        :param history: The conversation history to be formatted
        :return: A formatted string
        """
        return "Current conversation:\n" + "\n".join(
            [f"User: {agent_input.message}\n{agent_output.agent_type.value}: {agent_output.message_for_user}" for
             agent_input, agent_output in history])


class Agent(ABC):
    """
    An abstract class for an agent.
    """

    @abstractmethod
    async def execute(self, user_input: AgentInput, history: ConversationHistory) -> AgentOutput:
        """
        Execute the agent's task
        :param user_input: The user input
        :param history: The conversation history
        :return: The agent output
        """
        raise NotImplementedError()
