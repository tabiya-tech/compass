import pytest
from pydantic import BaseModel

from features.skills_ranking.ranking_service.utils.other_job_seekers_ranking import other_job_seekers_ranking


class TestCase(BaseModel):
    jobseekers_ranks: list[float]
    """
    The list of all jobseekers' ranks.
    """

    participant_rank: float
    """
    The new participant's rank.
    """

    expected_percentile: float
    """
    Expected percentile of the participant's rank in the distribution of other jobseekers' ranks.
    """


test_cases: list[TestCase] = [
    TestCase(
        jobseekers_ranks=[0.1, 0.2, 0.3, 0.4, 0.5],
        participant_rank=0.3,
        expected_percentile=0.50
    ),
    TestCase(
        jobseekers_ranks=[0.1, 0.2, 0.3, 0.4, 0.5],
        participant_rank=0.1,
        expected_percentile=0.1,
    ),
    TestCase(
        jobseekers_ranks=[0.10, 0.20, 0.30, 0.40, 0.50],
        participant_rank=0.5,
        expected_percentile=0.9
    ),
    TestCase(
        jobseekers_ranks=[0.10, 0.20, 0.30, 0.40, 0.50],
        participant_rank=0.05,
        expected_percentile=0.0,
    ),
    TestCase(
        jobseekers_ranks=[],
        participant_rank=0.5,
        expected_percentile=1,
    ),
    TestCase(
        jobseekers_ranks=[0.60, 0.70, 0.80],
        participant_rank=0.7,
        expected_percentile=0.5,
    ),
    TestCase(
        jobseekers_ranks=[0.50, 0.50, 0.50, 0.50],
        participant_rank=0.5,
        expected_percentile=0.5
    ),
    TestCase(
        jobseekers_ranks=[0.9, 0.92, 0.95, 0.97],
        participant_rank=0.85,
        expected_percentile=0.0,
    ),
    TestCase(
        jobseekers_ranks=[0.1, 0.2, 0.2, 0.3],
        participant_rank=0.2,
        expected_percentile=0.5
    ),
]

@pytest.mark.parametrize("case", [
    pytest.param(
        case,
        id=f"should return {case.expected_percentile}%, given participant rank: {case.participant_rank}"
    ) for case in test_cases])
def test_compute_group(case: TestCase):
    # GIVEN a list of jobseekers' ranks, and a participant's rank
    given_jobseekers_ranks = case.jobseekers_ranks

    # AND the participant's rank
    given_participant_rank = case.participant_rank

    # WHEN the percentile rank is computed
    actual_rank = other_job_seekers_ranking(
        job_seekers_ranks=given_jobseekers_ranks,
        participant_rank=given_participant_rank
    )

    # THEN the actual rank should match the expected percentile
    assert actual_rank == case.expected_percentile, f"Expected {case.expected_percentile}%, but got {actual_rank} for case: {case}"
