import asyncio

from fastapi import Depends

from .get_opportunities_data_service import get_opportunities_data_service
from .opportunities_data_service import IOpportunitiesDataService
from .ranking_service import IRankingService, RankingService
from features.skills_ranking.config import get_skills_ranking_config
from features.skills_ranking.ranking_service.repositories.get_job_seekers_repository import get_job_seekers_repository
from features.skills_ranking.ranking_service.repositories.types import IJobSeekersRepository, ITaxonomyRepository
from features.skills_ranking.ranking_service.repositories.get_taxonomy_repository import get_taxonomy_repository
from app.app_config import get_application_config

_ranking_service_singleton: IRankingService | None = None
_ranking_service_lock = asyncio.Lock()


async def get_ranking_service(
        job_seekers_repository: IJobSeekersRepository = Depends(get_job_seekers_repository),
        opportunities_data_service: IOpportunitiesDataService = Depends(get_opportunities_data_service),
        taxonomy_repository: ITaxonomyRepository = Depends(get_taxonomy_repository),
        config=Depends(lambda: get_skills_ranking_config())
) -> IRankingService:
    global _ranking_service_singleton

    # initial check to avoid the lock if the singleton instance is already created (lock is expensive)
    if _ranking_service_singleton is None:

        # before modifying the singleton instance, acquire the lock
        async with _ranking_service_lock:
            # double check after acquiring the lock
            if _ranking_service_singleton is None:
                _ranking_service_singleton = RankingService(
                    job_seekers_repository=job_seekers_repository,
                    taxonomy_repository=taxonomy_repository,
                    opportunities_data_service=opportunities_data_service,
                    config=config,
                    taxonomy_model_id=get_application_config().taxonomy_model_id)

    return _ranking_service_singleton
