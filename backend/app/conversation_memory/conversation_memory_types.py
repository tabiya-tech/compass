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
    all_history: ConversationHistory
    """The full conversation history"""
    history: ConversationHistory
    """The most recent conversation history that has not be summarized"""
    summary: str
    """The summary of the conversation"""


class ConversationMemoryManagerState(BaseModel):
    """
    The state of the conversation memory manager
    """
    session_id: int
    all_history: ConversationHistory
    unsummarized_history: ConversationHistory
    to_be_summarized_history: ConversationHistory
    summary: str

    def __init__(self, session_id):
        super().__init__(session_id=session_id,
                         all_history=ConversationHistory(),
                         unsummarized_history=ConversationHistory(),
                         to_be_summarized_history=ConversationHistory(),
                         summary="")
