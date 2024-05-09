from enum import Enum
from typing import Optional

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
