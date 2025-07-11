from app.agent.experience import ExperienceEntity
from app.agent.explore_experiences_agent_director import DiveInPhase
from app.application_state import ApplicationState


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
