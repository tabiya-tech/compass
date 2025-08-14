from pydantic import BaseModel, Field


class RankingServiceConfig(BaseModel):
    """
    Configuration for the Ranking Service.
    """

    matching_threshold: float = Field(ge=0, le=1, default=0.5)
    """
    The threshold for matching opportunities with job seekers. 
    This value is used to determine if the job seeker's skills are fit for an opportunity.
    
    eg: to be able to match the job you need 70% of the required skills. so the matching_threshold is '0.7'
    
    Default value is 0.5 (50%). (If a user matches 50% of the required skills, they will be considered a match).
    """

    fetch_job_seekers_batch_size: int = Field(default=250, ge=1)
    """
    The batch size number to get the job seekers.
    Default is 250.
    """


class OpportunitiesDataServiceConfig(BaseModel):
    """
    Configuration for the Opportunities Data Service.
    """

    fetch_opportunities_batch_size: int = Field(default=250, ge=1)
    """
    The batch size number to get the skills from the opportunities.
    Default is 250.
    """

    fetch_opportunities_limit: int = Field(default=50000, ge=1)
    """
    The limit of the number of opportunities to fetch skills from.
    """

    opportunities_data_stale_time: int = Field(default=6 * 60 * 60, ge=1)
    """
    Opportunity data stale time in seconds.
    Default is 6 hours (6 * 60 * 60 seconds).
    """
