from app.agent.agent_director.abstract_agent_director import AbstractAgentDirector
from app.agent.agent_types import AgentInput, AgentOutput
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.conversation_memory.conversation_memory_types import ConversationContext


class AgentDirectorExecutor:
    """
    Executes the agent director
    """

    def __init__(self, agent_director: AbstractAgentDirector):
        self._agent = agent_director

    async def __call__(self, agent_input: AgentInput) -> AgentOutput:
        """
        Executes the welcome agent
        """
        agent_output = await self._agent.execute(agent_input)
        return agent_output


class AgentDirectorGetConversationContextExecutor:
    """
    Returns the conversation context
    """

    def __init__(self, conversation_manager: ConversationMemoryManager):
        self._conversation_manager = conversation_manager

    async def __call__(self) -> ConversationContext:
        """
        Returns the conversation context
        """
        return await self._conversation_manager.get_conversation_context()


class AgentDirectorIsFinished:
    """
    Checks if the agent_director is finished
    """

    def __call__(self, agent_output: AgentOutput) -> bool:
        """
        Checks if the agent director is finished
        """
        return agent_output.finished and agent_output.agent_type is None
