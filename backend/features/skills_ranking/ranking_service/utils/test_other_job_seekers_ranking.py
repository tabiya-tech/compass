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

    doc: str
    """
    Documentation string explaining the test case.
    """



test_cases: list[TestCase] = [
    TestCase(
        jobseekers_ranks=[10, 20, 30, 40, 50],
        participant_rank=30,
        expected_percentile=60.0,
        doc="3 out of 5 jobseekers have rank <= 30 → (3/5)*100 = 60.0"
    ),
    TestCase(
        jobseekers_ranks=[10, 20, 30, 40, 50],
        participant_rank=10,
        expected_percentile=20.0,
        doc="1 out of 5 jobseekers have rank <= 10 → (1/5)*100 = 20.0"
    ),
    TestCase(
        jobseekers_ranks=[10, 20, 30, 40, 50],
        participant_rank=50,
        expected_percentile=100.0,
        doc="All 5 have rank <= 50 → (5/5)*100 = 100.0"
    ),
    TestCase(
        jobseekers_ranks=[10, 20, 30, 40, 50],
        participant_rank=5,
        expected_percentile=0.0,
        doc="0 out of 5 have rank <= 5 → (0/5)*100 = 0.0"
    ),
    TestCase(
        jobseekers_ranks=[],
        participant_rank=50,
        expected_percentile=100.0,
        doc="Empty list → You a re the only participant, so you are at 100%"
    ),
    TestCase(
        jobseekers_ranks=[60, 70, 80],
        participant_rank=70,
        expected_percentile=66.67,
        doc="2 out of 3 have rank <= 70 → (2/3)*100 = 66.67"
    ),
    TestCase(
        jobseekers_ranks=[50, 50, 50, 50],
        participant_rank=50,
        expected_percentile=62.5,
        doc="All 4 jobseekers have same rank as participant, so average rank is (1+2+3+4)/4 = 2.5 → (2.5/4)*100 = 62.5"
    ),
    TestCase(
        jobseekers_ranks=[90, 92, 95, 97],
        participant_rank=85,
        expected_percentile=0.0,
        doc="No jobseeker has rank <= 85 → (0/4)*100 = 0.0"
    ),
    TestCase(
        jobseekers_ranks=[10, 20, 20, 30],
        participant_rank=20,
        expected_percentile=62.5,
        doc="2 of 5 have rank 20, so average rank is (2+3)/2 = 2.5 → (2.5/4)*100 = 62.5"
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
    result = other_job_seekers_ranking(
        job_seekers_ranks=given_jobseekers_ranks,
        participant_rank=given_participant_rank
    )

    # THEN the result should match the expected percentile
    assert result == case.expected_percentile, f"Expected {case.expected_percentile}%, but got {result} for case: {case}"
