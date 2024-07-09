from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.collect_experiences_agent import CollectExperiencesAgent, CollectExperiencesAgentState
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.conversation_memory.conversation_memory_types import ConversationContext


class CollectExperiencesAgentExecutor:
    """
    Executes the Collect Experiences agent
    """

    def __init__(self, conversation_manager: ConversationMemoryManager, session_id: int):
        self._agent = CollectExperiencesAgent()
        self._agent.set_state(CollectExperiencesAgentState(session_id=session_id))
        self._conversation_manager = conversation_manager

    def get_experiences(self):
        return self._agent.get_experiences()

    async def __call__(self, agent_input: AgentInput) -> AgentOutput:
        """
        Executes the collect experience agent
        """
        context = await self._conversation_manager.get_conversation_context()
        agent_output = await self._agent.execute(agent_input, context)
        await self._conversation_manager.update_history(agent_input, agent_output)
        return agent_output


class CollectExperienceAgentGetConversationContextExecutor:
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


class CollectExperienceAgentIsFinished:
    """
    Checks if the collect experience agent is finished
    """

    def __call__(self, agent_output: AgentOutput) -> bool:
        """
        Checks if the collect experience agent is finished
        """
        return agent_output.finished
