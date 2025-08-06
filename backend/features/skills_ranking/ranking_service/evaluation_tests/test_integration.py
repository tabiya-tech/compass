import json

import pytest

import features.skills_ranking.ranking_service.evaluation_tests.test_repositories as test_repositories
from features.skills_ranking.ranking_service.evaluation_tests._types import IntegrationTestCase
from features.skills_ranking.ranking_service.services.config import RankingServiceConfig
from features.skills_ranking.ranking_service.services.ranking_service import RankingService
from features.skills_ranking.state.services.type import SkillRankingExperimentGroup
from features.skills_ranking.state.utils.get_group import TargetGroup, get_group

test_opportunities_data_service = test_repositories.TestOpportunitiesDataService()
test_job_seekers_data_repository = test_repositories.TestJobSeekersDataRepository()

test_cases = test_job_seekers_data_repository.get_test_cases()

def get_group_from_test_case(test_case: str) -> SkillRankingExperimentGroup:
    values = {
        "Group 1a": SkillRankingExperimentGroup.GROUP_1,
        "Group 1b": SkillRankingExperimentGroup.GROUP_2,
        "Group 2a": SkillRankingExperimentGroup.GROUP_3,
        "Group 2b": SkillRankingExperimentGroup.GROUP_4,
    }

    return values.get(test_case, SkillRankingExperimentGroup.GROUP_1)  # Default to GROUP_1 if not found

@pytest.mark.asyncio
@pytest.mark.parametrize("test_case", test_cases)
async def test_ranking_service_integration(test_case: IntegrationTestCase, mocker):
    # GIVEN the participant skills
    participant_skills = test_job_seekers_data_repository.get_skills_by_external_user_id(test_case.given_external_user_id)

    # GUARD: ensure that the participant has skills
    assert len(participant_skills) > 0, f"No skills found for external user ID: {test_case.given_external_user_id}"

    # AND given some matching threshold
    given_matching_threshold = 0.5

    # AND given the fetch data batch size
    fetch_data_batch_size = 10

    # AND the ranking service is initialized
    ranking_service = RankingService(
        test_job_seekers_data_repository,
        test_opportunities_data_service,
        RankingServiceConfig(
            matching_threshold=given_matching_threshold,
            fetch_job_seekers_batch_size=fetch_data_batch_size
        )
    )

    # WHEN the ranks are calculated
    actual_rank = await ranking_service.get_participant_ranking(
        user_id=test_case.given_external_user_id,
        participants_skills_uuids=participant_skills,
        prior_belief=test_case.given_prior_opportunity_rank_belief,
    )

    # THEN the ranks match the expected values
    #   Convert the percentage above a threshold to a rank
    assert actual_rank.jobs_matching_rank == test_case.expected_opportunity_rank
    assert actual_rank.comparison_rank == test_case.expected_job_seekers_rank

    # GIVEN the randomization returns the given target group.
    target_group = TargetGroup.HIGH_DIFFERENCE if test_case.given_random_target_group == 1 else TargetGroup.UNDERCONFIDENT
    mocker.patch("features.skills_ranking.state.utils.get_group._get_random_group", return_value=target_group)

    # AND the high difference threshold is set
    given_high_difference_threshold = 0.2

    # WHEN the group is computed
    actual_assigned_group = get_group(self_estimated_rank=test_case.given_prior_opportunity_rank_belief,
                                        actual_rank=actual_rank.jobs_matching_rank,
                                        high_difference_threshold=given_high_difference_threshold)

    # THEN the assigned group matches the expected group
    assert actual_assigned_group == get_group_from_test_case(test_case.expected_assigned_group)
