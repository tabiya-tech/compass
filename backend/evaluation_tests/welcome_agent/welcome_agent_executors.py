from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.welcome_agent import WelcomeAgent
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.conversation_memory.conversation_memory_types import ConversationContext


class WelcomeAgentExecutor:
    """
    Executes the welcome agent
    """

    def __init__(self, conversation_manager: ConversationMemoryManager):
        self._agent = WelcomeAgent()
        self._conversation_manager = conversation_manager

    async def __call__(self, agent_input: AgentInput) -> AgentOutput:
        """
        Executes the welcome agent
        """
        context = await self._conversation_manager.get_conversation_context()
        agent_output = await self._agent.execute(agent_input, context)
        await self._conversation_manager.update_history(agent_input, agent_output)
        return agent_output


class WelcomeAgentGetConversationContextExecutor:
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


class WelcomeAgentIsFinished:
    """
    Checks if the welcome agent is finished
    """

    def __call__(self, agent_output: AgentOutput) -> bool:
        """
        Checks if the welcome agent is finished
        """
        return agent_output.finished
