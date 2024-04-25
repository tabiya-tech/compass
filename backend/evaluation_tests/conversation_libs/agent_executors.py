from typing import Protocol, runtime_checkable
from app.agent.agent_types import AgentOutput, AgentInput
from app.conversation_memory.conversation_memory_manager import ConversationHistory


@runtime_checkable
class ExecuteAgentCallable(Protocol):
    """
    A function that executes an agent and returns the output.
    """

    async def __call__(self, *, agent_input: AgentInput) -> AgentOutput:
        ...


@runtime_checkable
class CheckAgentFinishedCallable(Protocol):
    """
    A function that checks whether the agent has finished the conversation.
    """

    def __call__(self, *, agent_output: AgentOutput) -> bool:
        ...


@runtime_checkable
class GetConversationHistoryCallable(Protocol):
    """
    A function that returns the conversation history.
    """

    async def __call__(self) -> ConversationHistory:
        ...
