"""
Common Types shared by the ranking service and state manager
"""
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


class SkillsRankingScore(BaseModel):
    """
    Demand-focused skill insights returned by the external skills-ranking-service.
    """

    calculated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    """
    Timestamp (UTC) for when the demand calculation was performed.
    """

    above_average_labels: list[str] = Field(default_factory=list)
    """
    Skill groups where the participant outperforms the regional/job-market average.
    """

    below_average_labels: list[str] = Field(default_factory=list)
    """
    Skill groups where the participant underperforms relative to the market average.
    """

    most_demanded_label: str
    """
    The participant's most demanded skill group.
    """

    most_demanded_percent: float
    """
    Demand percentage associated with the `most_demanded_label`.
    """

    least_demanded_label: str
    """
    The participant's least demanded skill group.
    """

    least_demanded_percent: float
    """
    Demand percentage associated with the `least_demanded_label`.
    """

    average_percent_for_jobseeker_skillgroups: float
    """
    Average demand percentage across the participant's matched skill groups.
    """

    average_count_for_jobseeker_skillgroups: float
    """
    Average job count across the participant's matched skill groups.
    """

    province_used: str
    """
    Province reference used for aggregating labour market demand.
    """

    matched_skillgroups: int
    """
    Number of skill groups matched between the participant and the market data.
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
