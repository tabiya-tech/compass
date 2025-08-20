import datetime

import pytest
from pydantic import BaseModel

from common_libs.test_utilities import get_random_user_id
from common_libs.time_utilities import truncate_microseconds
from features.skills_ranking.ranking_service.repositories.get_job_seekers_repository import get_job_seekers_repository
from features.skills_ranking.ranking_service.repositories.job_seekers_mongo_repository import _from_db_document
from features.skills_ranking.ranking_service.repositories.get_opportunities_data_repository import \
    get_opportunities_data_repository
from features.skills_ranking.ranking_service.repositories.get_taxonomy_repository import get_taxonomy_repository
from features.skills_ranking.ranking_service.services.config import RankingServiceConfig, OpportunitiesDataServiceConfig
from features.skills_ranking.ranking_service.services.get_opportunities_data_service import \
    get_opportunities_data_service
from features.skills_ranking.ranking_service.services.get_ranking_service import get_ranking_service
from features.skills_ranking.types import PriorBeliefs


class TestCase(BaseModel):
    id: str
    given_participant_skills_uuids: set[str]
    given_job_seekers_prior_belies: PriorBeliefs
    given_opportunities_skills_uuids: list[dict]
    given_skills_data: list[dict]
    given_job_seekers_data: list[dict]

    expected_participant_score: float
    expected_comparison_rank: float
    expected_comparison_label: str
    expected_data_set_version: str
    expected_total_opportunities: int
    expected_total_matching_opportunities: int
    expected_discovered_skill_groups: set[str]


test_cases = [
    TestCase(
        id="sample",
        given_participant_skills_uuids={"skill-uuid-1"},
        given_job_seekers_prior_belies=PriorBeliefs(),
        given_opportunities_skills_uuids=[
            {
                "active": True,
                "skillGroups": [{ "UUID": "skill-group-uuid-1" }]
            }
        ],
        given_skills_data=[
            {
                "UUID": "skill-uuid-1",
                "skillGroups": [{ "UUID": "skill-group-uuid-1" }]
            }
        ],
        given_job_seekers_data=[
            {
                "opportunityRank": 0
            }
        ],
        expected_discovered_skill_groups={"skill-group-uuid-1"},
        expected_total_opportunities=1,
        expected_total_matching_opportunities=1,
        expected_data_set_version="eb55be98a4adab8e7e3466ce42e3919d", # calculated manually.
        expected_participant_score=1.0,
        expected_comparison_rank=1.0,
        expected_comparison_label="HIGHEST"
    ),
]


@pytest.mark.asyncio
@pytest.mark.parametrize("test_case", test_cases, ids=[case.id for case in test_cases])
async def test_ranking_service_success(test_case, in_memory_job_seekers_db, in_memory_opportunity_data_db, caplog, setup_application_config):
    # GIVEN a participant with user id, set of skills and a prior belief
    given_user_id = get_random_user_id()
    given_participant_skills_uuids = test_case.given_participant_skills_uuids
    given_participant_prior_beliefs = test_case.given_job_seekers_prior_belies

    # AND a list of opportunities in the database
    given_opportunities_collection_name = "opportunities"
    await in_memory_opportunity_data_db.get_collection(given_opportunities_collection_name).insert_many(test_case.given_opportunities_skills_uuids)
    opportunities_data_repository = await get_opportunities_data_repository(in_memory_opportunity_data_db,
                                                                            given_opportunities_collection_name)
    opportunities_data_service_config = OpportunitiesDataServiceConfig()
    opportunities_data_service = await get_opportunities_data_service(opportunities_data_repository,
                                                                      opportunities_data_service_config)

    # AND a list of jobseekers in the database
    given_job_seekers_data_collection_name = "job_seekers"
    await in_memory_job_seekers_db.get_collection(given_job_seekers_data_collection_name).insert_many(test_case.given_job_seekers_data)
    job_seekers_repository = await get_job_seekers_repository(in_memory_job_seekers_db,
                                                              given_job_seekers_data_collection_name)

    # AND a list of skills in the taxonomy data
    given_skills_collection_name = "skills"
    await in_memory_opportunity_data_db.get_collection(given_skills_collection_name).insert_many(test_case.given_skills_data)
    taxonomy_repository = await get_taxonomy_repository(in_memory_opportunity_data_db, given_skills_collection_name)

    # WHEN we calculate the skills ranking for a participant from the
    ranking_service_config = RankingServiceConfig(
        matching_threshold=0.05
    )
    ranking_service = await get_ranking_service(
        job_seekers_repository=job_seekers_repository,
        opportunities_data_service=opportunities_data_service,
        taxonomy_repository=taxonomy_repository,
        config=ranking_service_config
    )

    participant_score = await ranking_service.get_participant_ranking(
        user_id=given_user_id,
        prior_beliefs=given_participant_prior_beliefs,
        participants_skills_uuids=given_participant_skills_uuids
    )

    # THEN we expect the skill ranking service to be calculated successfully without errors.
    assert participant_score.jobs_matching_rank == test_case.expected_participant_score

    # AND the comparison rank and label to be as expected
    assert participant_score.comparison_rank == test_case.expected_comparison_rank

    # AND the comparison label to be as expected
    assert participant_score.comparison_label == test_case.expected_comparison_label

    # AND the opportunities data set version to be as expected
    assert opportunities_data_service.dataset_version == test_case.expected_data_set_version

    # AND the calculated_at field to be set and of type datetime
    assert participant_score.calculated_at is not None
    assert isinstance(participant_score.calculated_at, datetime.datetime)

    # AND the saved job seeker rank should match the expected values
    saved_job_seeker = await in_memory_job_seekers_db.get_collection(given_job_seekers_data_collection_name).find_one({"compassUserId": given_user_id})
    saved_job_seeker = _from_db_document(saved_job_seeker)

    assert saved_job_seeker.user_id == given_user_id
    assert saved_job_seeker.opportunity_rank == test_case.expected_participant_score
    assert saved_job_seeker.compared_to_others_rank == test_case.expected_comparison_rank
    assert saved_job_seeker.compare_to_others_prior_belief == given_participant_prior_beliefs.compare_to_others_prior_belief
    assert saved_job_seeker.opportunity_rank_prior_belief == given_participant_prior_beliefs.opportunity_rank_prior_belief
    assert saved_job_seeker.skills_uuids == test_case.given_participant_skills_uuids
    assert saved_job_seeker.skill_groups_uuids == test_case.expected_discovered_skill_groups
    assert saved_job_seeker.total_matching_opportunities == test_case.expected_total_matching_opportunities
    assert saved_job_seeker.number_of_total_opportunities == test_case.expected_total_opportunities
    assert saved_job_seeker.matching_threshold == ranking_service_config.matching_threshold
    assert saved_job_seeker.opportunity_dataset_version == test_case.expected_data_set_version
    assert saved_job_seeker.opportunities_last_fetch_time == truncate_microseconds(opportunities_data_service.last_fetch_time) # truncate microseconds because mongo does not store them


    # AND no error should be logged during the process
    assert "ERROR" not in caplog.text
    assert "Exception" not in caplog.text
    assert "Traceback" not in caplog.text
