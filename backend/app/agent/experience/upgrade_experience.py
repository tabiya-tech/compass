from app.agent.experience import ExperienceEntity
from app.vector_search.esco_entities import SkillEntity


def get_editable_experience(experience: ExperienceEntity) -> ExperienceEntity[tuple[int, SkillEntity]]:
    """
    Returns an editable version of the experience entity.

    This is used to ensure that the experience entity can be modified
    without affecting the original entity.

    Top skills and remaining skills are indexed to allow for easier ordering when editing.
    """
    top_skills_length = len(experience.top_skills)
    return experience.model_copy(
        update={
            "top_skills": [(index, skill) for index, skill in enumerate(experience.top_skills)],

            # the remaining skills will be indexed starting from the end of `top_skills`,
            # so the index will be top_skills_length + index
            "remaining_skills": [((index + top_skills_length), skill) for index, skill in enumerate(experience.remaining_skills)]
        }
    )
