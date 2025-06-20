from app.agent.experience import ExperienceEntity
from app.agent.explore_experiences_agent_director import DiveInPhase
from app.application_state import ApplicationState


def has_explored_experiences(state: ApplicationState) -> bool:
    """
    Check if some explored experiences in the state.
    """
    experiences = state.explore_experiences_director_state.experiences_state.values()
    return any(
        exp_state.dive_in_phase == DiveInPhase.PROCESSED
        for exp_state in experiences
    )

def filter_explored_experiences(state: ApplicationState) -> list[ExperienceEntity]:
    """
    Populate explored_experiences based on experiences_state
    where dive_in_phase == DiveInPhase.PROCESSED
    """
    return [
        exp_state.experience
        for exp_state in state.explore_experiences_director_state.experiences_state.values()
        if exp_state.dive_in_phase == DiveInPhase.PROCESSED
    ]
