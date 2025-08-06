import pytest
from pydantic import BaseModel

from features.skills_ranking.ranking_service.utils.opportunity_ranking import get_opportunity_ranking


class TestCase(BaseModel):
    given_jobs_skills: list[set[str]]
    """
    The skills required for each job, represented as a list of sets of skill UUIDs.
    """

    given_participant_skills_uuids: set[str]
    """
    The skills of the participant, represented as a set of skill UUIDs.
    """

    given_matching_threshold: float
    """
    The threshold for matching ranks, which skills to match to consider a participant fit for a job.
    """

    expected_ranking: float
    """
    The expected percentage of jobs that the participant is qualified for based on their skills.
    """

    doc: str
    """
    Documentation string explaining the test case.
    """

test_cases: list[TestCase] = [
    TestCase(
        given_jobs_skills=[{"skill1", "skill2"}, {"skill3", "skill4"}],
        given_participant_skills_uuids={"skill6", "skill7"},
        given_matching_threshold=0.5,
        expected_ranking=0,
        doc="Participant doesn't fit any job skills, so 0% ranking."
    ),
    TestCase(
        given_jobs_skills=[{"skill1", "skill2", "skill3"}, {"skill4", "skill5", "skill6"}],
        given_participant_skills_uuids={"skill1", "skill2", "skill5"},
        given_matching_threshold=0.5,
        expected_ranking=0.5,
        doc="Participant fits more than 50% skills of 1 job out of 2 jobs, so 50% ranking."
    ),
    TestCase(
        given_jobs_skills=[{"skill1", "skill2"}, {"skill3", "skill4"}],
        given_participant_skills_uuids={"skill1", "skill2", "skill3", "skill4"},
        given_matching_threshold=0.5,
        expected_ranking=1.0,
        doc="Participant fits all skills of 1 job and all skills of another job, so 100% ranking."
    ),
]

@pytest.mark.parametrize("case", [
    pytest.param(
        case,
        id=f"should return {case.expected_ranking}%"
    ) for case in test_cases])
def test_opportunity_ranking(case):
    # GIVEN the parameters for the opportunity ranking
    given_jobs_skills = case.given_jobs_skills

    # AND the participant's skills
    given_participant_skills_uuids = case.given_participant_skills_uuids

    # AND the matching threshold
    given_matching_threshold = case.given_matching_threshold

    # WHEN we compute the opportunity ranking
    result = get_opportunity_ranking(
        opportunities_skills_uuids=given_jobs_skills,
        participant_skills_uuids=given_participant_skills_uuids,
        opportunity_matching_threshold=given_matching_threshold
    )

    # THEN the result should match the expected ranking
    assert result == case.expected_ranking, f"Expected {case.expected_ranking}%, got {result}% for case: {case.doc}"
