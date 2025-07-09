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

CompareAgainst = Literal["against_other_job_seekers", "against_job_market"]
ButtonOrder = Literal["skip_button_first", "view_button_first"]


class SkillRankingExperimentGroup(Enum):
    """
    Skills Ranking Experiment Groups assigned to the user. Each group has its own branch in the skills ranking flow
        Group 1: The expected flow for group 1 is that the user will go through a time based effort task to get the ranking results
                and gets to actually see the ranking results (unlike groups 2 and 4). The group 1 users will also be asked to retype the
                results of the ranking task before completing the skills ranking process.
        Group 2: The expected flow for group 2 is that the user will go through a high effort task (not necessarily time based) to get the ranking results
                this group (along with group 4) will not get to see the ranking results, and will not be asked to retype the results of the ranking task before
                completing the skills ranking process.
        Group 3: Same basic flow as group 1
        Group 4: Same basic flow as group 2
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
