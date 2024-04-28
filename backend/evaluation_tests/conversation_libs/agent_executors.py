from typing import Protocol, runtime_checkable
from app.agent.agent_types import AgentOutput, AgentInput
from app.conversation_memory.conversation_memory_manager import ConversationHistory


@runtime_checkable
class ExecuteAgentCallable(Protocol):
    """
    A function that executes an agent and returns the output.
    """

    async def __call__(self, *, agent_input: AgentInput) -> AgentOutput:
        """
        :param agent_input: The input to the agent
        :return: The output from the agent in response to the input.
        """
        raise NotImplementedError


@runtime_checkable
class CheckAgentFinishedCallable(Protocol):
    """
    A function that checks whether the agent has finished the conversation.
    """

    def __call__(self, *, agent_output: AgentOutput) -> bool:
        """
        :param agent_output: The output from the agent.
        :return: True if the agent has finished the conversation, False otherwise.
        """
        raise NotImplementedError


@runtime_checkable
class GetConversationHistoryCallable(Protocol):
    """
    A function that returns the conversation history.
    """

    async def __call__(self) -> ConversationHistory:
        raise NotImplementedError


@runtime_checkable
class ExecuteSimulatedUserCallable(Protocol):
    """
    A function that executes a simulated user and returns the user's response
    """

    async def __call__(self, *, turn_number: int, message_for_user: str) -> str:
        """
        :param turn_number: The turn number of the conversation.
        :param message_for_user: The message that the user should respond to.
        :return: The response from the simulated user.
        """
        raise NotImplementedError
