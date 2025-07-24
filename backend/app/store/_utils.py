from app.agent.experience import ExperienceEntity
from app.agent.experience.upgrade_experience import get_editable_experience
from app.agent.explore_experiences_agent_director import DiveInPhase
from app.application_state import ApplicationState
from app.vector_search.esco_entities import SkillEntity


def filter_explored_experiences(state: ApplicationState) -> list[ExperienceEntity[tuple[int, SkillEntity]]]:
    """
    Populate explored_experiences based on experiences_state
    where dive_in_phase == DiveInPhase.PROCESSED
    """
    return [
        get_editable_experience(exp_state.experience)
        for exp_state in state.explore_experiences_director_state.experiences_state.values()
        if exp_state.dive_in_phase == DiveInPhase.PROCESSED
    ]
