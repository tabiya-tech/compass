from typing import Optional, Mapping, Any

from pydantic import BaseModel, Field

from app.agent.agent_types import AgentInput, AgentOutput


class ConversationTurn(BaseModel):
    """
      A model for a conversation turn
    """
    index: int
    """The index of the turn in the conversation history"""
    input: AgentInput
    """The input from the user to the agent"""
    output: AgentOutput
    """The output from the agent to the user"""


class ConversationHistory(BaseModel):
    """
      A model for a conversation history
    """
    turns: list[ConversationTurn] = Field(default_factory=list)


class ConversationContext(BaseModel):
    """
      A model for a conversation context, constructed from the conversation history and summary
    """
    all_history: ConversationHistory
    """The full conversation history"""
    history: ConversationHistory
    """The most recent conversation history that has not be summarized"""
    summary: str = ""
    """The summary of the conversation"""

    def __init__(self, *, all_history: ConversationHistory = None, history: ConversationHistory = None, summary: str = ""):
        super().__init__(
            all_history=all_history if all_history is not None else ConversationHistory(),
            history=history if history is not None else ConversationHistory(),
            summary=summary
        )


class ConversationMemoryManagerState(BaseModel):
    """
    The state of the conversation memory manager
    """
    session_id: int
    all_history: ConversationHistory = Field(default_factory=lambda: ConversationHistory())
    unsummarized_history: ConversationHistory = Field(default_factory=lambda: ConversationHistory())
    to_be_summarized_history: ConversationHistory = Field(default_factory=lambda: ConversationHistory())
    summary: str = ""

    class Config:
        extra = "forbid"

    @staticmethod
    def from_document(_doc: Mapping[str, Any]) -> "ConversationMemoryManagerState":
        return ConversationMemoryManagerState(session_id=_doc["session_id"],
                                              all_history=_doc["all_history"],
                                              unsummarized_history=_doc["unsummarized_history"],
                                              to_be_summarized_history=_doc["to_be_summarized_history"],
                                              summary=_doc["summary"])
