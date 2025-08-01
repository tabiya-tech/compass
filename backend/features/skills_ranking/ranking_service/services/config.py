from pydantic import BaseModel, Field


class RankingServiceConfig(BaseModel):
    matching_threshold: float = Field(ge=0, le=1)
    """
    The threshold for matching opportunities with job seekers. 
    This value is used to determine how many opportunities, a job seeker matches.
    
    eg: to be able to match the job you need 70% of the required skills. so the matching_threshold is '0.7'
    """

    fetch_job_seekers_batch_size: int = Field(default=250, ge=1)
    """
    The batch size number to get the job seekers.
    Default is 250.
    """


class OpportunitiesDataServiceConfig(BaseModel):
    fetch_opportunities_batch_size: int = Field(default=250, ge=1)
    """
    The batch size number to get the skills from the opportunities.
    Default is 250.
    """

    fetch_opportunities_limit: int = Field(default=50000, ge=1)
    """
    The limit of the number of opportunities to fetch skills from.
    """
