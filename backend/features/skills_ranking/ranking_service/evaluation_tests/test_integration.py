import pytest

import features.skills_ranking.ranking_service.evaluation_tests.test_repositories as test_repositories

from features.skills_ranking.ranking_service.evaluation_tests._types import IntegrationTestCase
from features.skills_ranking.ranking_service.services.config import RankingServiceConfig
from features.skills_ranking.ranking_service.services.ranking_service import RankingService
from features.skills_ranking.state.services.type import SkillRankingExperimentGroup
from features.skills_ranking.state.utils.get_group import TargetGroup, get_group
from features.skills_ranking.types import PriorBeliefs

test_opportunities_data_service = test_repositories.TestOpportunitiesDataService()
test_job_seekers_data_repository = test_repositories.TestJobSeekersDataRepository()

# get the test cases from the jobseeker data repository
test_cases = test_job_seekers_data_repository.get_test_cases()


def get_group_from_test_case(group_name: str) -> SkillRankingExperimentGroup:
    """
    Convert the group name from the opportunity dataset to the corresponding `SkillRankingExperimentGroup` Enum.

    :param group_name: The name of the group as defined in the opportunity dataset.
    :return: SkillRankingExperimentGroup Enum corresponding to the group name.
    """

    # Define the mapping from group names to SkillRankingExperimentGroup Enums
    skill_ranking_experiment_groups = {
        "Group 1a": SkillRankingExperimentGroup.GROUP_1,
        "Group 1b": SkillRankingExperimentGroup.GROUP_2,
        "Group 2a": SkillRankingExperimentGroup.GROUP_3,
        "Group 2b": SkillRankingExperimentGroup.GROUP_4,
    }

    # GUARD: ensure that the group name is valid
    skill_ranking_experiment_group = skill_ranking_experiment_groups.get(group_name, None)
    if skill_ranking_experiment_group is None:
        raise ValueError(
            f"Unknown group name: {group_name}. Expected one of {list(skill_ranking_experiment_groups.keys())}")

    return skill_ranking_experiment_group


@pytest.mark.asyncio
@pytest.mark.parametrize("test_case", test_cases)
async def test_ranking_service_integration(test_case: IntegrationTestCase, mocker):
    # GIVEN the participant skills
    given_participant_skills = test_job_seekers_data_repository.get_skills_by_external_user_id(
        test_case.given_external_user_id)

    # AND given a matching threshold
    given_matching_threshold = test_case.given_matching_threshold

    # AND given the fetch data batch size
    fetch_data_batch_size = 100

    # AND the ranking service is initialized
    ranking_service = RankingService(test_job_seekers_data_repository,
                                     test_opportunities_data_service,
                                     RankingServiceConfig(matching_threshold=given_matching_threshold,
                                                          fetch_job_seekers_batch_size=fetch_data_batch_size))

    # WHEN the actual rank is calculated
    given_prior_beliefs = PriorBeliefs(
        compare_to_others_prior_belief=test_case.given_prior_job_seekers_rank_belief,
        opportunity_rank_prior_belief=test_case.given_prior_opportunity_rank_belief
    )
    actual_rank = await ranking_service.get_participant_ranking(user_id=test_case.given_external_user_id,
                                                                participants_skills_uuids=given_participant_skills,
                                                                prior_beliefs=given_prior_beliefs)

    # THEN the actual rank ranks should match the expected values
    assert actual_rank.jobs_matching_rank == test_case.expected_opportunity_rank
    assert actual_rank.comparison_rank == test_case.expected_job_seekers_rank

    # GIVEN the randomization returns the given target group.
    target_group = TargetGroup.HIGH_DIFFERENCE if test_case.given_random_target_group == 1 else TargetGroup.UNDERCONFIDENT
    mocker.patch("features.skills_ranking.state.utils.get_group._get_random_group", return_value=target_group)

    # AND given the high-difference threshold
    given_high_difference_threshold = test_case.given_high_difference_threshold

    # WHEN the group is computed
    actual_assigned_group = get_group(self_estimated_rank=test_case.given_prior_opportunity_rank_belief,
                                      actual_rank=actual_rank.jobs_matching_rank,
                                      high_difference_threshold=given_high_difference_threshold)

    # THEN the assigned group matches the expected group
    assert actual_assigned_group == get_group_from_test_case(test_case.expected_assigned_group)
