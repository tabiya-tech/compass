from app.agent.agent_director.abstract_agent_director import AgentDirectorState
from app.agent.collect_experiences_agent import CollectExperiencesAgentState
from app.agent.explore_experiences_agent_director import ExploreExperiencesAgentDirectorState
from app.agent.skill_explorer_agent import SkillsExplorerAgentState
from app.application_state import ApplicationState
from app.conversation_memory.conversation_memory_types import ConversationMemoryManagerState


def get_mock_application_state(session_id) -> ApplicationState:
    return ApplicationState(
        session_id=session_id,
        agent_director_state=AgentDirectorState(session_id=session_id),
        explore_experiences_director_state=ExploreExperiencesAgentDirectorState(session_id=session_id),
        conversation_memory_manager_state=ConversationMemoryManagerState(session_id=session_id),
        collect_experience_state=CollectExperiencesAgentState(session_id=session_id),
        skills_explorer_agent_state=SkillsExplorerAgentState(session_id=session_id)
    )