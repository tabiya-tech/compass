from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.skill_explore_agent import SkillExplorerAgent
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.conversation_memory.conversation_memory_types import ConversationContext


class SkillExploreAgentExecutor:
    """
    Executes the skill explore agent
    """

    def __init__(self, conversation_manager: ConversationMemoryManager):
        self._agent = SkillExplorerAgent()
        self._conversation_manager = conversation_manager

    async def __call__(self, agent_input: AgentInput) -> AgentOutput:
        """
        Executes the skills explore agent
        """
        context = await self._conversation_manager.get_conversation_context()
        agent_output = await self._agent.execute(agent_input, context)
        await self._conversation_manager.update_history(agent_input, agent_output)
        return agent_output


class SkillExploreAgentGetConversationContextExecutor:
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


class SkillExploreAgentIsFinished:
    """
    Checks if the skill explore agent is finished
    """

    def __call__(self, agent_output: AgentOutput) -> bool:
        """
        Checks if the skill explore agent is finished
        """
        return agent_output.finished
