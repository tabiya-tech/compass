from typing import Optional
from datetime import datetime

from pydantic import BaseModel


class JobSeeker(BaseModel):
    user_id: str
    """
    The unique identifier for the job seeker.
    """

    external_user_id: Optional[str] = None
    """
    The external identifier for the job seeker, if available.
    """

    skills_uuids: set[str]
    """
    The set of unique skill identifiers associated with the job seeker.
    """

    skill_groups_uuids: set[str]
    """
    The set of unique skill group identifiers associated with the job seeker.
    """

    taxonomy_model_id: Optional[str] = None
    """
    The taxonomy model identifier used when the user was ranked.
    """

    opportunity_rank_prior_belief: Optional[float] = None
    """
    The prior belief of the job seeker's rank in relation to available opportunities.
    """

    opportunity_rank: float
    """
    The rank of the job seeker based on their skills in relation to available opportunities.
    """

    compare_to_others_prior_belief: Optional[float] = None
    """
    The prior belief of the job seeker's rank compared to other job seekers.
    """

    compared_to_others_rank: float
    """
    The rank of the job seeker compared to other job seekers.
    """

    opportunity_dataset_version: Optional[str] = None
    """
    The hash of the opportunity dataset used during ranking.
    This is used to ensure that we can tell which calculations used the same dataset.
    """

    number_of_total_opportunities: Optional[int] = None
    """
    Total number of opportunities considered at ranking time.
    """

    total_matching_opportunities: Optional[int] = None
    """
    Number of opportunities matching above the threshold.
    """

    matching_threshold: Optional[float] = None
    """
    The matching threshold used for this calculation.
    """

    opportunities_last_fetch_time: Optional[datetime] = None
    """
    The last time the opportunities dataset was fetched into cache.
    Used for traceability of the dataset freshness at ranking time.
    """
