import logging

from pydantic_settings import BaseSettings

from features.skills_ranking.ranking_service.repositories.job_seekers_mongo_repository import JobSeekersMongoRepository
from features.skills_ranking.ranking_service.repositories.opportunities_data_mongo_repository import \
    OpportunitiesDataRepository
from features.skills_ranking.ranking_service.repositories.types import IJobSeekersRepository
from features.skills_ranking.ranking_service.services.config import RankingServiceConfig, OpportunitiesDataServiceConfig
from features.skills_ranking.ranking_service.services.opportunities_data_service import IOpportunitiesDataService, \
    OpportunitiesDataService
from features.skills_ranking.ranking_service.batch_processor._ranking_service import RankingService
from features.skills_ranking.ranking_service.types import JobSeeker
from scripts.export_discovered_skills.utils import get_db_connection


class Settings(BaseSettings):
    """
    Batch Processor settings.
    """

    job_seekers_mongodb_uri: str
    """
    The URI of the job seekers MongoDB instance.
    """

    job_seekers_database_name: str
    """
    The name of the job seekers database.
    """

    job_seekers_collection_name: str
    """
    The collection name for the job seekers data.
    """

    opportunity_data_mongodb_uri: str
    """
    The URI of the opportunity data MongoDB instance.
    """

    opportunity_data_database_name: str
    """
    The name of the opportunity data database.
    """

    opportunity_data_collection_name: str
    """
    The collection name for the opportunity data.
    """

    ranking_service_config: RankingServiceConfig
    """
    Configurations for the ranking service
    """

    class Config:
        env_prefix = "SKILLS_RANKING_BATCH_PROCESSOR_"


class BatchProcessor:
    def __init__(self,
                 job_seeker_repository: IJobSeekersRepository,
                 opportunities_data_service: IOpportunitiesDataService,
                 ranking_service_config: RankingServiceConfig):

        self._job_seeker_repository = job_seeker_repository
        self._ranking_service = RankingService(
            opportunities_data_service=opportunities_data_service,
            matching_threshold=ranking_service_config.matching_threshold
        )

        self._logger = logging.getLogger(self.__class__.__name__)

    async def process_job_seeker(self, job_seeker: JobSeeker, dry_run: bool):
        # 1. construct ranking service
        self._logger.info(
            "Processing job seeker compass user id=%s, external user id=%s", job_seeker.user_id,
            job_seeker.external_user_id)

        # Calculate the jobseeker ranks and save them.
        updated_job_seeker = await self._ranking_service.re_rank_job_seeker(job_seeker)
        if dry_run:
            self._logger.info(
                f"Dry run mode. Skipping saving job seeker rank. Job seeker to save: {updated_job_seeker}")
        else:
            self._logger.info(f"Saving job seeker rank. Job seeker to save: {updated_job_seeker}")
            await self._job_seeker_repository.update_job_seeker(updated_job_seeker)


async def re_rank_job_seekers(*,
                              rerank_all: bool,
                              dry_run: bool):
    """

    :param rerank_all: weather to re-rank all jobseekers or only those where the dataset has changed since the last ranking.
    :param dry_run: Weather to run the script without making any changes to the database.
    """
    logger = logging.getLogger(__name__)
    logger.info(f"Starting re-ranking jobseekers with options: rerank_all={rerank_all}, dry_run={dry_run}")

    _settings = Settings()  # type: ignore

    _job_seekers_db = get_db_connection(_settings.job_seekers_mongodb_uri, _settings.job_seekers_database_name)
    _opportunities_data_db = get_db_connection(_settings.opportunity_data_mongodb_uri,
                                               _settings.opportunity_data_database_name)

    try:
        # 1. construct batch processor dependencies.
        #   — jobseeker repository
        _job_seekers_repository = JobSeekersMongoRepository(_job_seekers_db, _settings.job_seekers_collection_name)

        # — opportunities data service
        _opportunities_data_service = OpportunitiesDataService(
            OpportunitiesDataRepository(
                _opportunities_data_db,
                _settings.opportunity_data_collection_name
            ),
            OpportunitiesDataServiceConfig()
        )

        # 2. construct batch processor
        _batch_processor = BatchProcessor(
            _job_seekers_repository,
            _opportunities_data_service,
            _settings.ranking_service_config
        )

        # 3. process jobseekers in batches
        job_seekers_cursor = _job_seekers_repository.stream(batch_size=50)

        # GUARD: pre-fetch opportunities data to assert at least we have some opportunities in the database.
        opportunities = await _opportunities_data_service.get_opportunities_skills_uuids()
        if not opportunities or len(opportunities) == 0:
            raise ValueError("No opportunities found in the database. Cannot proceed with re-ranking.")

        # Iterate over jobseekers and process them one by one.
        async for job_seeker in job_seekers_cursor:
            # If the user (function caller) wanted to skip unchanged datasets,
            # we will check if the dataset has changed since the last ranking.
            # If not, we will skip this jobseeker. Otherwise, we will process them using our BatchProcessor.
            if not rerank_all:
                input_dataset_version_changed = job_seeker.dataset_info.input_opportunities.hash != _opportunities_data_service.dataset_version
                input_dataset_number_changed = job_seeker.dataset_info.input_opportunities.total_count != len(
                    opportunities)

                if not input_dataset_version_changed and not input_dataset_number_changed:
                    logger.info(
                        f"Skipping job seeker user-id: {job_seeker.user_id}, external user id: {job_seeker.external_user_id} as the input dataset has not changed.")
                    continue

            await _batch_processor.process_job_seeker(job_seeker, dry_run)
    finally:
        # close database connections
        _job_seekers_db.client.close()
        _opportunities_data_db.client.close()
