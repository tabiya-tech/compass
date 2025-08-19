from typing import Optional

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
    The version of the opportunity dataset used for ranking the job seeker.
    """
