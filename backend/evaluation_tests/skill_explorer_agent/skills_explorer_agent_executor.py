from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.experience.experience_entity import ExperienceEntity
from app.agent.skill_explorer_agent import SkillsExplorerAgent, SkillsExplorerAgentState
from app.conversation_memory.conversation_memory_manager import ConversationMemoryManager
from app.conversation_memory.conversation_memory_types import ConversationContext


class SkillsExplorerAgentExecutor:
    """
    Executes the Skills Explorer Agent
    """

    def __init__(self, conversation_manager: ConversationMemoryManager, state: SkillsExplorerAgentState, experience: ExperienceEntity):
        self._agent = SkillsExplorerAgent()
        self._agent.set_state(state)
        self._agent.set_experience(experience)
        self._conversation_manager = conversation_manager

    async def __call__(self, agent_input: AgentInput) -> AgentOutput:
        """
        Executes the agent
        """
        context = await self._conversation_manager.get_conversation_context()
        agent_output = await self._agent.execute(user_input=agent_input, context=context)
        await self._conversation_manager.update_history(agent_input, agent_output)
        return agent_output


class SkillsExplorerAgentGetConversationContextExecutor:
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


class SkillsExplorerAgentIsFinished:
    """
    Checks if the agent is finished
    """

    def __call__(self, agent_output: AgentOutput) -> bool:
        """
        Checks if the collect experience agent is finished
        """
        return agent_output.finished
