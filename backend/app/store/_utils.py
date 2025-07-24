from app.agent.experience import ExperienceEntity
from app.agent.explore_experiences_agent_director import DiveInPhase
from app.application_state import ApplicationState
from app.vector_search.esco_entities import SkillEntity


def _get_editable_experience(experience: ExperienceEntity) -> ExperienceEntity[tuple[int, SkillEntity]]:
    """
    Returns an editable version of the experience entity.
    This is used to ensure that the experience entity can be modified
    without affecting the original entity.
    """
    return experience.model_copy(
        update={
            "top_skills": [(index, skill) for index, skill in enumerate(experience.top_skills)],
            "remaining_skills": [(index, skill) for index, skill in enumerate(experience.remaining_skills)]
        }
    )


def filter_explored_experiences(state: ApplicationState) -> list[ExperienceEntity[tuple[int, SkillEntity]]]:
    """
    Populate explored_experiences based on experiences_state
    where dive_in_phase == DiveInPhase.PROCESSED
    """
    return [
        _get_editable_experience(exp_state.experience_entity)
        for exp_state in state.explore_experiences_director_state.experiences_state.values()
        if exp_state.dive_in_phase == DiveInPhase.PROCESSED
    ]
