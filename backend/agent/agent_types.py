from abc import ABC, abstractmethod
from enum import Enum
from typing import List, Tuple, TypeAlias, Optional

from pydantic import BaseModel


class AgentType(Enum):
    WELCOME_AGENT = "WelcomeAgent"
    SKILL_EXPLORER_AGENT = "SkillExplorerAgent"
    FAREWELL_AGENT = "FarewellAgent"


class AgentInput(BaseModel):
    message: str  # Bad idea, rename


class AgentOutput(BaseModel):
    message_for_user: str
    finished: bool
    agent_type: Optional[AgentType] = None


ConversationHistory: TypeAlias = List[Tuple[AgentInput, AgentOutput]]


class Agent(ABC):
    @abstractmethod
    async def execute(self, user_input: AgentInput) -> AgentOutput:
        raise NotImplementedError()

    @abstractmethod
    async def reset(self):
        raise NotImplementedError()