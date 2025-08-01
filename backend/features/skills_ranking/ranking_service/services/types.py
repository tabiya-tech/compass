from pydantic import BaseModel


class JobSeeker(BaseModel):
    user_id: str
    """
    The unique identifier for the job seeker.
    """

    skills_uuids: set[str]
    """
    The set of unique skill identifiers associated with the job seeker.
    """

    opportunity_rank: float
    """
    The rank of the job seeker based on their skills in relation to available opportunities.
    """

    prior_belief: float
