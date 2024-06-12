from enum import Enum
from typing import Optional

from pydantic import BaseModel


class AgentType(Enum):
    """
    An enumeration for agent types
    """
    WELCOME_AGENT = "WelcomeAgent"
    SKILL_EXPLORER_AGENT = "SkillExplorerAgent"
    EXPERIENCES_EXPLORER_AGENT = "ExperiencesExplorerAgent"
    FAREWELL_AGENT = "FarewellAgent"
    QNA_AGENT = "QnaAgent"


class AgentInput(BaseModel):
    """
    The input to an agent
    """
    message: str  # Bad idea, rename


class LLMStats(BaseModel):
    """
    The stats for an LLM call
    """
    error: str = ""
    """The error message if there was an error"""
    prompt_token_count: int
    """The number of tokens in the prompt sent to the LLM"""
    response_token_count: int
    """The number of tokens in the response generated by the LLM"""
    response_time_in_sec: float
    """The time it took to generate the response, it may include multiple retries"""


class AgentOutput(BaseModel):
    """
    The output of an agent
    """
    message_for_user: str
    """The message for the user"""
    finished: bool
    """Whether the the agent has finished its task"""
    agent_type: Optional[AgentType] = None
    """The type of the agent that produced the response"""
    reasoning: str
    """The CoT reasoning behind the response"""
    agent_response_time_in_sec: float
    """The total time it took the agent to produce a response. It may include multiple calls to LLMs or tools"""
    llm_stats: list[LLMStats]
    """The stats for each call to an LLM that was used to generate the response"""
