"""
Common Types shared by the ranking service and state manager
"""
from datetime import datetime

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
