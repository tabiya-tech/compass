from typing import TypeAlias

from pydantic import BaseModel

from app.agent.agent_types import AgentInput, AgentOutput


class ConversationTurn(BaseModel):
    """
      A model for a conversation turn
    """
    index: int
    input: AgentInput
    output: AgentOutput


class ConversationHistory(BaseModel):
    """
      A model for a conversation history
    """
    turns: list[ConversationTurn] = []


class ConversationContext(BaseModel):
    """
      A model for a conversation context, constructed from the conversation history and summary
    """
    history: ConversationHistory
    summary: str


ConversationSummaryDict: TypeAlias = dict[int, str]
ConversationHistoryDict: TypeAlias = dict[int, ConversationHistory]
