from enum import Enum
import random
from typing import Literal

from pydantic import BaseModel, Field, field_validator, field_serializer


class SkillsRankingPhase(Enum):
    INITIAL = "INITIAL"
    SKIPPED = "SKIPPED"
    CANCELLED = "CANCELLED"
    SELF_EVALUATING = "SELF_EVALUATING"
    EVALUATED = "EVALUATED"


CompareAgainst = Literal["against_other_job_seekers", "against_job_market"]
ButtonOrder = Literal["skip_button_first", "view_button_first"]


class SkillRankingExperimentGroups(BaseModel):
    """
    Skill Ranking Experiment Groups — The groups of the skill ranking experiment.
    """

    compare_against: CompareAgainst = Field(default=random.choice(["against_other_job_seekers", "against_job_market"])) # nosec B311 # random is fine here, we are not using it for security
    """
    the entity the user will be compared to
    """
    button_order: ButtonOrder = Field(default=random.choice(["skip_button_first", "view_button_first"])) # nosec B311 # random is fine here, we are not using it for security
    """
    the order of the buttons
    """
    delayed_results: bool = Field(default=random.choice([True, False])) # nosec B311 # random is fine here, we are not using it for security
    """
    whether the results are delayed
    """


class SkillsRankingState(BaseModel):
    """
    Skills Ranking State — The state of the skills ranking process.
    """

    session_id: int
    """
    session id - the session ranking will be made on
    """

    experiment_groups: SkillRankingExperimentGroups
    """
    the groups the user is assigned for each experiment branch under the skills ranking experiment
    """

    phase: SkillsRankingPhase
    """
    The current phase of the skills ranking process.
    """

    ranking: str | None = None
    """
    The ranking of the skills got during a conversation.
    """

    self_ranking: str | None = None
    """
    The self ranking of the skills got during a conversation.
    """

    @field_validator("phase", mode='before')
    def deserialize_phase(cls, value: str | SkillsRankingPhase) -> SkillsRankingPhase:
        if isinstance(value, str):
            return SkillsRankingPhase[value]
        return value

    @field_serializer("phase")
    def serialize_sent_at(self, phase: SkillsRankingPhase) -> str:
        return phase.value