from pydantic import BaseModel


class IntegrationTestCase(BaseModel):
    given_external_user_id: str
    """
    External user ID used to identify the user in the external system (eg: Harambee)
    """

    given_compass_user_id: str
    """
    Compass user ID used to identify the user in compass system.
    """

    given_prior_opportunity_rank_belief: float
    """
    Opportunity rank belief of the jobseeker before the actual compass conversation experience. (How jobseeker ranks compared to the opportunities available)
    """

    given_prior_job_seekers_rank_belief: float
    """
    Job seekers rank belief of the jobseeker before the actual compass conversation experience. (How the jobseeker compares to other job seekers)
    """

    given_random_target_group: int
    """
    Given random target group for the jobseeker. This is used to assign the jobseeker to a specific group in the randomization.
    
    1 -> TargetGroup.HIGH_DIFFERENCE (use is_high_difference to assign the group)
    2 -> TargetGroup.UNDERCONFIDENT (use is_underconfident to assign the group)
    """

    expected_overlap_scores: list[float]
    """
    How the job seeker won against the opportunities dataset.
    """

    given_matching_threshold: float
    """
    This is used to determine how many skills required to match the job seeker with the opportunities.
    """

    given_high_difference_threshold: float
    """
    This is used to determine if there is a high difference between the self-estimated rank and the actual rank of the job seeker.
    """

    expected_number_of_jobs_above_threshold: int
    """
    Expected number of jobs above the threshold for the job seeker.
    """

    expected_opportunity_rank: float
    """
    Expected opportunity rank of the job seeker after the actual compass conversation experience.
    """

    expected_job_seekers_rank: float
    """
    Expected job seekers rank of the job seeker after the actual compass conversation experience.
    """

    expected_assigned_group: str
    """
    Expected assigned group for the job seeker after the actual compass conversation experience.
    @see to the backend/features/skills_ranking/state/utils/get_group.py#get_group on how grouping works.
    """

    class Config:
        extra = "forbid"
