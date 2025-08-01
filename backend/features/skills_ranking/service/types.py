from datetime import datetime
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field

SkillsRankingPhaseName = Literal[
    "INITIAL",
    "BRIEFING",
    "PROOF_OF_VALUE",
    "MARKET_DISCLOSURE",
    "JOB_SEEKER_DISCLOSURE",
    "PERCEIVED_RANK",
    "RETYPED_RANK",
    "COMPLETED"]


class UpdateSkillsRankingRequest(BaseModel):
    """
    Request model for updating skills ranking state.

    - If a field is omitted, it will not be updated.
    - If a field is present with a null value, it will be cleared (set to None).
    - If a field is present with a value, it will be updated to that value.
    """
    phase: Optional[SkillsRankingPhaseName] = Field(
        default=None,
        description="The phase of the skills ranking process. If omitted, not updated. If null, cleared."
    )
    cancelled_after: Optional[str] = Field(
        default=None,
        description="Represents the time spent by the user before they cancelled the skills ranking process (ms). If omitted, not updated. If null, cleared."
    )
    succeeded_after: Optional[str] = Field(
        default=None,
        description="Represents the time spent by the user after they succeeded in the skills ranking process (ms). If omitted, not updated. If null, cleared."
    )
    puzzles_solved: Optional[int] = Field(
        default=None,
        description="The number of puzzles the user solved for the proof_of_value task. If omitted, not updated. If null, cleared."
    )
    correct_rotations: Optional[int] = Field(
        default=None,
        description="The number of characters the user rotated correctly for the proof_of_value task. If omitted, not updated. If null, cleared."
    )
    clicks_count: Optional[int] = Field(
        default=None,
        description="The number of clicks the user made during the proof_of_value task. If omitted, not updated. If null, cleared."
    )
    perceived_rank_percentile: Optional[float] = Field(
        default=None,
        description="The percentile rank the user thinks they have (0-100). If omitted, not updated. If null, cleared."
    )
    retyped_rank_percentile: Optional[float] = Field(
        default=None,
        description="The rank the user retyped to confirm they saw it correctly (0-100). If omitted, not updated. If null, cleared."
    )
    completed_at: Optional[datetime] = Field(
        default=None,
        description="The time the skills ranking process completed. If omitted, not updated. If null, cleared."
    )

    class Config:
        extra = "forbid"


class SkillsRankingPhase(BaseModel):
    """
    Skills Ranking Phase — The phase of the skills ranking process.
    """

    name: SkillsRankingPhaseName
    """
    The name of the phase.
    """
    time: datetime
    """
    The time the phase started, in ISO format, in UTC.
    """

    class Config:
        extra = "forbid"
        use_enum_values = True
        allow_population_by_field_name = True


class SkillRankingExperimentGroup(Enum):
    """
    Skills Ranking Experiment Groups assigned to the user. Each group has its own branch in the skills ranking flow

    Differences between the groups:

    Group 1:
        - time based proof_of_value task
        - see ranking results.
        - confirm they've seen the ranking results
    Group 2:
        - work based proof_of_value task
        - not see ranking results.
    Group 3:
            - work based proof_of_value task
            - see ranking results.
            - confirm they've seen the ranking results
    Group 4:
        - time based proof_of_value task
        - not see ranking results.
    """

    GROUP_1 = "Group 1: High Difference/Greater"
    GROUP_2 = "Group 2: High Difference/Smaller"
    GROUP_3 = "Group 3: Underconfidence/Yes"
    GROUP_4 = "Group 4: Underconfidence/No"


class SkillsRankingScore(BaseModel):
    jobs_matching_rank: float
    """
    The rank of the user as compared to the job market.
    """

    comparison_rank: float
    """
    The rank of the user as compared to other job seekers.
    """

    comparison_label: str
    """
    The label of the comparison rank, LOWEST, SECOND_LOWEST, MIDDLE, SECOND_HIGHEST, HIGHEST.
    """

    calculated_at: datetime
    """
    The time the score was calculated, in ISO format, in UTC.
    """

    class Config:
        extra = "forbid"


class SkillsRankingState(BaseModel):
    """
    Skills Ranking State — The state of the skills ranking process.
    """

    session_id: int
    """
    session id - the session ranking will be made on
    """

    experiment_group: SkillRankingExperimentGroup
    """
    the group the user is assigned for each experiment branch
    """

    phase: list[SkillsRankingPhase]
    """
    The current phase of the skills ranking process.
    """

    score: SkillsRankingScore
    """
    The score given to the user as compared to other job seekers and the job market.
    """

    cancelled_after: str | None = None
    """
    Represents the time spent by the user before they cancelled the skills ranking process (ms)
    """

    succeeded_after: str | None = None
    """
    Represents the time spent by the user after they succeeded in the skills ranking process (ms)
    """

    puzzles_solved: int | None = None
    """
    The number of puzzles the user solved for the proof_of_value task during the skills ranking process.
    This is only relevant for the effort-based proof_of_value task.
    """

    correct_rotations: int | None = None
    """
    The number of characters the user rotated correctly for the proof_of_value task during the skills ranking process.
    This is only relevant for the time-based proof_of_value task.
    """

    clicks_count: int | None = None
    """
    The number of clicks the user made during the proof_of_value task. character selection, rotation [clockwise/counter-clockwise]
    This is only relevant for the time-based proof_of_value task.
    """

    perceived_rank_percentile: float | None = None
    """
    The percentile rank the user thinks they have (0-100)
    """

    retyped_rank_percentile: float | None = None
    """
    The rank the user retyped to confirm they saw it correctly (0-100)
    """

    started_at: datetime
    """
    The time the skills ranking process started, in ISO format, in UTC.
    """

    completed_at: datetime | None = None
    """
    The time the skills ranking process completed, in ISO format, in UTC.
    """

    class Config:
        extra = "forbid"
