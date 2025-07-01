from typing import Annotated, Optional, List

from pydantic import Field, BaseModel

from app.agent.experience import ExperienceEntity, Timeline, WorkType
from app.agent.experience.experience_entity import BaseExperienceEntity
from app.agent.explore_experiences_agent_director import DiveInPhase

from app.vector_search.esco_entities import SkillEntity

# Field length limits (keep in sync with frontend)
EXPERIENCE_TITLE_MAX_LENGTH = 100
COMPANY_MAX_LENGTH = 100
LOCATION_MAX_LENGTH = 100
SUMMARY_MAX_LENGTH = 1000
UUID_MAX_LENGTH = 36
SKILL_LABEL_MAX_LENGTH = 100
TIMELINE_MAX_LENGTH = 30


class Skill(SkillEntity):
    """
    A skill entity for the user.
    It excludes the fields that are not needed in the response.
    """
    # The following fields are excluded from the response.
    id: Annotated[Optional[str], Field(exclude=True)] = None
    modelId: Annotated[Optional[str], Field(exclude=True)] = None
    score: Annotated[Optional[float], Field(exclude=True)] = None
    skillType: Annotated[Optional[str], Field(exclude=True)] = None

    class Config:
        extra = "forbid"


class ExperienceResponse(BaseExperienceEntity):
    """
    Response model for an experience.
    Inherits all fields from BaseExperienceEntity and adds exploration_phase and top_skills.
    """
    uuid: Annotated[str, Field(serialization_alias="UUID", description="Unique identifier for the experience.")]
    exploration_phase: Annotated[str, Field(
        description=f"The current sub-phase of the experience exploration. Allowed values: {[e.name for e in DiveInPhase]}",
        examples=[e.name for e in DiveInPhase],
    )] = DiveInPhase.NOT_STARTED.name
    top_skills: Annotated[List[Skill], Field(description="List of skills identified as relevant to the experience.")]

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
    A skill to be updated in an experience.
    """

    UUID: Annotated[
        str,
        Field(
            description="Unique identifier for the skill.",
            max_length=UUID_MAX_LENGTH
        )]

    preferredLabel: Annotated[
        str,
        Field(
            description="The preferred label for the skill.",
            max_length=SKILL_LABEL_MAX_LENGTH
        )]

    class Config:
        extra = "forbid"

class TimelineUpdate(Timeline):
    start: Optional[str] = Field(
        default=None,
        description="The start date of the experience. If omitted, not updated. If null, cleared.",
        examples=["A long time ago", "2020", "2020-01", "2020-01-01"],
        max_length=TIMELINE_MAX_LENGTH,
    )

    end: Optional[str] = Field(
        default=None,
        description="The end date of the experience. If omitted, not updated. If null, cleared.",
        examples=["Present", "2021", "2021-12", "2021-12-31", "Present", "A long time ago"],
        max_length=TIMELINE_MAX_LENGTH,
    )

class UpdateExperienceRequest(BaseModel):
    """
    Request model for updating an experience.

    - If a field is omitted, it will not be updated.
    - If a field is present with a null value, it will be cleared (set to None or empty).
    - If a field is present with a value, it will be updated to that value.

    Special handling for top_skills:
    - If omitted: top_skills will not be updated.
    - If present as null: all skills will be removed (set to empty list).
    - If present as an empty list: all skills will be removed (set to empty list).
    - If present as a list of SkillUpdate: will update to that list.
    """
    experience_title: Optional[str] = Field(
        default=None,
        description="The title of the experience. If omitted, not updated. If null, cleared.",
        examples=["Crew Member"],
        max_length=EXPERIENCE_TITLE_MAX_LENGTH
    )
    timeline: Optional[TimelineUpdate] = Field(
        default=None,
        description="The timeline of the experience (start/end). If omitted, not updated. If null, cleared.",
    )
    company: Optional[str] = Field(
        default=None,
        description="The company name. If omitted, not updated. If null, cleared.",
        examples=["McDonald's"],
        max_length=COMPANY_MAX_LENGTH
    )
    location: Optional[str] = Field(
        default=None,
        description="The location of the experience. If omitted, not updated. If null, cleared.",
        examples=["Cape Town, South Africa"],
        max_length=LOCATION_MAX_LENGTH
    )

    # Use the type as `str` to allow the API user to send the keys.
    # By default, Pydantic will convert the enum to its value.
    # And the client is expected to send send the keys instead of the values.
    work_type: Optional[str] = Field(
        default=None,
        description="The type of work. "
                    "If omitted, not updated. If null, cleared. "
                    "If an invalid value is provided, null will be saved.",
        examples=[WorkType.FORMAL_SECTOR_WAGED_EMPLOYMENT.name],
        max_length=max(len(e.name) for e in WorkType),
        json_schema_extra={"enum": [e.name for e in WorkType] + [None]}
    )
    summary: Optional[str] = Field(
        default=None,
        description="A summary of the experience. If omitted, not updated. If null, cleared.",
        examples=["Worked as a crew member at McDonald's."],
        max_length=SUMMARY_MAX_LENGTH
    )
    top_skills: Optional[List[SkillUpdate]] = Field(
        default=None,
        description="List of skills to update. If omitted, not updated. If null or empty list, all skills will be removed.",
        examples=[[{"UUID": "skill-uuid-1", "preferredLabel": "Customer Service"}]]
    )

    class Config:
        extra = "forbid"
