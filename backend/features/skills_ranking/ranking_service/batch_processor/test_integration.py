import pytest

from common_libs.time_utilities import truncate_microseconds
from features.skills_ranking.ranking_service.batch_processor.main import BatchProcessor
from features.skills_ranking.ranking_service.repositories.job_seekers_mongo_repository import JobSeekersMongoRepository
from features.skills_ranking.ranking_service.repositories.opportunities_data_mongo_repository import \
    OpportunitiesDataRepository
from features.skills_ranking.ranking_service.repositories.test_job_seekers_mongo_repository import _get_test_job_seeker
from features.skills_ranking.ranking_service.services.config import RankingServiceConfig, OpportunitiesDataServiceConfig
from features.skills_ranking.ranking_service.services.opportunities_data_service import OpportunitiesDataService


@pytest.mark.asyncio
async def test_batch_processor_integration(in_memory_job_seekers_db, in_memory_opportunity_data_db, caplog):
    # GIVEN a jobseeker document
    given_job_seeker_document = _get_test_job_seeker()

    # AND the jobseeker database is populated with this document
    given_job_seekers_collection_name = "job_seekers_1"
    job_seekers_repository = JobSeekersMongoRepository(in_memory_job_seekers_db, given_job_seekers_collection_name)
    await job_seekers_repository.save_job_seeker_rank(given_job_seeker_document)

    opportunities_data_repository = OpportunitiesDataRepository(
        in_memory_opportunity_data_db,
        "opportunities_data_1",
    )
    await opportunities_data_repository._collection.insert_one(
        {"active": True, "skillGroups": [{"UUID": "skill-uuid-1"}]})

    # AND the opportunity data service is constructed
    opportunities_data_service = OpportunitiesDataService(
        opportunities_data_repository,
        OpportunitiesDataServiceConfig()
    )

    # WHEN the batch processor is run to re-rank jobseekers with ability to update the database (dry_run=False)
    ranking_service_config = RankingServiceConfig(matching_threshold=0.9)
    batch_processor = BatchProcessor(job_seekers_repository, opportunities_data_service, ranking_service_config)

    await batch_processor.process_job_seeker(job_seeker=given_job_seeker_document, dry_run=False)

    # THEN the process_job_seeker should complete without errors
    assert "ERROR" not in caplog.text
    assert "EXCEPTION" not in caplog.text

    # WHEN the jobseeker document is read from the database (read the first item as there should be only one)
    in_db_job_seeker = await job_seekers_repository.stream().__anext__()

    # GUARD: Assert that the jobseekers are the same.
    assert in_db_job_seeker.id == given_job_seeker_document.id

    # THEN the jobseeker document is processed and updated correctly,
    # AND new opportunity rank generated rank should be updated with a new one.
    assert in_db_job_seeker.opportunity_rank != given_job_seeker_document.opportunity_rank

    # AND the already existing rank should be added into the history of ranks.
    assert len(in_db_job_seeker.opportunity_rank_history) == len(given_job_seeker_document.opportunity_rank_history) + 1
    assert list(in_db_job_seeker.opportunity_rank_history.values()) == [given_job_seeker_document.opportunity_rank,
                                                                  in_db_job_seeker.opportunity_rank]

    # AND the dataset info should be updated to match the new dataset version.
    assert in_db_job_seeker.dataset_info.input_opportunities.hash == opportunities_data_service.dataset_version

    # AND the compared to other jobseekers rank should not be updated.
    assert in_db_job_seeker.compared_to_others_rank == given_job_seeker_document.compared_to_others_rank
    assert in_db_job_seeker.compared_to_others_rank_history == given_job_seeker_document.compared_to_others_rank_history

    # AND the opportunity data matching threshold should be the same as the config.
    assert in_db_job_seeker.dataset_info.matching_threshold == ranking_service_config.matching_threshold

    # AND the opportunity data fetch time should be the same as the opportunity data service.
    assert in_db_job_seeker.dataset_info.fetch_time == truncate_microseconds(opportunities_data_service.last_fetch_time)

    # AND the opportunity data version should be the same as the opportunity data service.
    assert in_db_job_seeker.dataset_info.input_opportunities.hash == opportunities_data_service.dataset_version
