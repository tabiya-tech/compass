"""
Common Types shared by the ranking service and state manager
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


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


class PriorBeliefs(BaseModel):
    """
    Prior beliefs about the jobseeker's rank.
    """

    external_user_id: Optional[str] = None
    """
    The external user ID of the job seeker, where the prior beliefs were recorded.
    """

    compare_to_others_prior_belief: Optional[float] = None
    """
    The prior belief of the job seeker's rank compared to other job seekers.
    """

    opportunity_rank_prior_belief: Optional[float] = None
    """
    The prior belief of the job seeker's rank in relation to available opportunities.
    """
