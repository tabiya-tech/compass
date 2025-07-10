from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel

SkillsRankingPhase = Literal[
    "INITIAL",
    "BRIEFING",
    "EFFORT",
    "DISCLOSURE",
    "PERCEIVED_RANK",
    "RETYPED_RANK",
    "CANCELLED",
    "COMPLETED"]


class SkillRankingExperimentGroup(Enum):
    """
    Skills Ranking Experiment Groups assigned to the user. Each group has its own branch in the skills ranking flow

    Differences between the groups:

    Group 1:
        - time based effort task
        - see ranking results.
        - confirm they've seen the ranking results
    Group 2:
        - work based effort task
        - not see ranking results.
    Group 3:
            - work based effort task
            - see ranking results.
            - confirm they've seen the ranking results
        Group 4:
            - time based effort task
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

    phase: SkillsRankingPhase
    """
    The current phase of the skills ranking process.
    """

    score: SkillsRankingScore
    """
    The score given to the user as compared to other job seekers and the job market.
    """

    cancelled_after: str | None = None
    """
    Represents the effort spent by the user before they cancelled the skills ranking process.
    Can be time in ms or a string indicating the effort type (e.g., "typed 4 characters").
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
