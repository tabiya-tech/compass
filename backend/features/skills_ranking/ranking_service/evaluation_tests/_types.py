from pydantic import BaseModel


class IntegrationTestCase(BaseModel):
    given_external_user_id: str
    given_compass_user_id: str
    given_prior_opportunity_rank_belief: float
    given_prior_job_seekers_rank_belief: float
    given_random_target_group: int

    expected_overlap_scores: list[float]
    expected_number_of_jobs_above_threshold: int
    expected_opportunity_rank: float
    expected_job_seekers_rank: float
    expected_assigned_group: str

    class Config:
        extra = "forbid"
