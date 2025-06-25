from typing import Annotated, Optional, List

from pydantic import Field, BaseModel, field_validator

from app.agent.experience import ExperienceEntity, Timeline, WorkType
from app.agent.experience.experience_entity import BaseExperienceEntity
from app.agent.explore_experiences_agent_director import DiveInPhase

from app.vector_search.esco_entities import SkillEntity


class Skill(SkillEntity):
    """
    A skill entity for the user,
    It excludes the fields that are not needed in the response.
    """

    # the following fields are excluded from the response.
    id: Annotated[Optional[str], Field(exclude=True)] = None
    modelId: Annotated[Optional[str], Field(exclude=True)] = None
    score: Annotated[Optional[float], Field(exclude=True)] = None
    skillType: Annotated[Optional[str], Field(exclude=True)] = None

    class Config:
        extra = "forbid"


class ExperienceResponse(BaseExperienceEntity):
    uuid: Annotated[str, Field(serialization_alias="UUID")]
    """
    Annotate the uuid field to match the format of capital letters.
    """

    exploration_phase: str = DiveInPhase.NOT_STARTED.name
    """
    Whether the experience has been explored in the conversation.
    """

    top_skills: List[Skill]
    """
    This skill is modified to use the Skill response model instead of SkillEntity.
    """

    class Config:
        extra = "forbid"

    @staticmethod
    def from_experience_entity(experience_entity: ExperienceEntity, dive_in_phase: DiveInPhase) -> "ExperienceResponse":
        """
        Converts an ExperienceEntity object into an Experience Response object by mapping its
        attributes and creating any necessary nested objects.
        """

        top_skills = [
            Skill(
                UUID=skill_entity.UUID,
                preferredLabel=skill_entity.preferredLabel,
                description=skill_entity.description,
                altLabels=skill_entity.altLabels
            )
            for skill_entity in experience_entity.top_skills
        ]

        return ExperienceResponse(
            uuid=experience_entity.uuid,
            experience_title=experience_entity.experience_title,
            company=experience_entity.company,
            location=experience_entity.location,
            timeline=experience_entity.timeline,
            work_type=experience_entity.work_type,
            top_skills=top_skills,
            summary=experience_entity.summary,
            exploration_phase=dive_in_phase.name
        )


class SkillUpdate(BaseModel):
    """
    A skill to be updated in an experience
    """
    UUID: str
    preferredLabel: str

    class Config:
        extra = "forbid"


class UpdateExperienceRequest(BaseModel):
    """
    Request model for updating an experience
    """
    experience_title: Optional[str] = None
    timeline: Optional[Timeline] = None
    company: Optional[str] = None
    location: Optional[str] = None
    work_type: Optional[str] = None
    summary: Optional[str] = None
    top_skills: Optional[List[SkillUpdate]] = None

    class Config:
        extra = "forbid"
