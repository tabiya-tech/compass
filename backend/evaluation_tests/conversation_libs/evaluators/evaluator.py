from abc import abstractmethod
from pydantic import BaseModel
from typing import Protocol

from app.conversation_memory.conversation_memory_types import ConversationContext

class EvaluationResult(BaseModel):
    """
    The result of the evaluation.
    """
    score: int
    reason: str

class Evaluator(Protocol):

    @abstractmethod
    async def evaluate(self, user_input: str, context: ConversationContext, agent_ouput: str) -> EvaluationResult:
        """Abstract method to evaluate a conversation between a user and an agent.
        """
        pass
