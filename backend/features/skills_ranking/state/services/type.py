from datetime import datetime
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_serializer, field_validator

from features.skills_ranking.types import SkillsRankingScore

SkillsRankingPhaseName = Literal[
    "INITIAL",
    "BRIEFING",
    "PROOF_OF_VALUE",
    "PRIOR_BELIEF",
    "PRIOR_BELIEF_FOR_SKILL",
    "DISCLOSURE",
    "APPLICATION_WILLINGNESS",
    "APPLICATION_24H",
    "PERCEIVED_RANK",
    "PERCEIVED_RANK_FOR_SKILL",
    "OPPORTUNITY_SKILL_REQUIREMENT",
    "COMPLETED",
]


class SkillRankingExperimentGroup(Enum):
    """
    Skills Ranking Experiment Groups assigned to the user. Each group has its own branch in the skills ranking flow:

    Group 1 (Control):
        - Opportunity skill requirements are shown before disclosure.
    Group 2 (Treatment A):
        - Participants see disclosure before application willingness questions.
        - Participants see only above average skill ranking score in disclosure
    Group 3 (Treatment B):
        - Same flow as Group 2 but may differ in messaging/experience.
        - Participants see both above and below average skill ranking scores in disclosure.
    """

    GROUP_1 = "Group 1: Control"
    GROUP_2 = "Group 2: Treatment A"
    GROUP_3 = "Group 3: Treatment B"


class ApplicationWillingness(BaseModel):
    value: int = Field(ge=1, le=6, description="Numeric value selected by the participant (1-6).")
    label: str = Field(min_length=1, description="Display label associated with the value.")


class UserResponses(BaseModel):
    prior_belief_percentile: float | None = Field(default=None, ge=0, le=100)
    prior_belief_for_skill_percentile: float | None = Field(default=None, ge=0, le=100)
    perceived_rank_percentile: float | None = Field(default=None, ge=0, le=100)
    perceived_rank_for_skill_percentile: float | None = Field(default=None, ge=0, le=100)
    application_willingness: ApplicationWillingness | None = None
    application_24h: int | None = Field(default=None, ge=0, le=24)
    opportunity_skill_requirement_percentile: float | None = Field(default=None, ge=0, le=100)


class ProcessMetadata(BaseModel):
    session_id: int
    experiment_group: SkillRankingExperimentGroup
    started_at: datetime
    completed_at: datetime | None = None
    cancelled_after: str | None = None
    succeeded_after: str | None = None
    puzzles_solved: int | None = None
    correct_rotations: int | None = None
    clicks_count: int | None = None

    @field_serializer("experiment_group")
    def serialize_experiment_group(self, experiment_group: SkillRankingExperimentGroup, _info):
        return experiment_group.name

    @field_validator("experiment_group", mode='before')
    def deserialize_experiment_group(cls, value):
        if isinstance(value, str):
            try:
                return SkillRankingExperimentGroup[value]
            except KeyError:
                for group in SkillRankingExperimentGroup:
                    if group.value == value:
                        return group
                raise ValueError(f"Invalid experiment group: {value}")
        return value


class UpdateSkillsRankingRequest(BaseModel):
    phase: Optional[SkillsRankingPhaseName] = None
    metadata: Optional[dict] = None
    user_responses: Optional[dict] = None
    completed_at: Optional[datetime] = None

    class Config:
        extra = "forbid"


class SkillsRankingPhase(BaseModel):
    name: SkillsRankingPhaseName
    time: datetime

    class Config:
        extra = "forbid"
        use_enum_values = True
        populate_by_name = True


class SkillsRankingState(BaseModel):
    phase: list[SkillsRankingPhase]
    metadata: ProcessMetadata
    score: SkillsRankingScore
    user_responses: UserResponses

    class Config:
        extra = "forbid"
