from typing import Optional, Literal
from datetime import datetime

from pydantic import BaseModel, Field

HashAlgorithms = Literal["md5"]  # We can add more algorithms in the future if needed.

class OpportunitiesInfo(BaseModel):
    total_count: int
    """
    Total number of opportunities.
    """

    hash: str
    """
    Hash of the actual opportunities skills/skill groups. 
    (Only skills and skill groups are hashed since they are the ones used to rank users.)
    
    We use a hash instead of storing the entire dataset to reduce storage requirements.  
    
    Hashing function:  
        features.skills_ranking.ranking_service.services.opportunities_data_service._compute_version_from_skills
    """

    hash_algo: Optional[HashAlgorithms]
    """
    Algorithm used to compute the hash. Default is "md5".
    """

    class Config:
        extra = "forbid"


class DatasetInfo(BaseModel):
    taxonomy_model_id: str
    """
    The taxonomy model identifier used when the user was ranked.
    """

    entities_used: Literal["skills", "skillGroups"]
    """
    The entities used to rank the user, either "skills" or "skillGroups".
    """

    matching_threshold: float
    """
    The matching threshold used to generate this ranking.
    """

    input_opportunities: OpportunitiesInfo
    """
    All the input opportunities used to generate the rank of the user. 
    """

    matching_opportunities: Optional[OpportunitiesInfo]
    """
    The opportunities that matched the user above the matching threshold.
    This can be None if the ranking was done before we started storing this information.
    """

    fetch_time: datetime
    """
    The time the dataset was fetched from the source (ie: database, api).
    """

    class Config:
        extra = "forbid"


RankingHistory = dict[datetime, float]
"""
The history entry of a ranking, consisting of a timestamp and the ranking value at that time.

For now we are using a dict of date-time to float, but in the future we might want to use a more complex structure.
Consisting of the dataset version that was used at the time.
"""


class JobSeeker(BaseModel):
    id: Optional[str] = None
    """
    The unique identifier for the job seeker document in the database.
    """

    user_id: str
    """
    The unique identifier for the job seeker.
    """

    external_user_id: Optional[str] = None
    """
    The external identifier for the job seeker, if available.
    """

    skills_origin_uuids: set[str]
    """
    The set of unique skill identifiers associated with the job seeker.
    """

    skill_groups_origin_uuids: set[str]
    """
    The set of unique skill group identifiers associated with the job seeker.
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

    dataset_info: DatasetInfo
    """
    The information about the dataset used to rank the job seeker.
    eg: the opportunities, and taxonomy model and the matching threshold.
    """

    opportunity_rank_history: RankingHistory = Field(default_factory=dict)
    """
    The history of the job seeker's rank in relation to available opportunities over time.
    """

    compared_to_others_rank_history: RankingHistory = Field(default_factory=dict)
    """
    The history of the job seeker's rank compared to other job seekers over time.
    """

    class Config:
        extra = "forbid"
