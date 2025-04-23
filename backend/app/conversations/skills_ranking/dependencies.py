import asyncio

from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.conversations.skills_ranking.repository import ISkillsRankingRepository, SkillsRankingRepository
from app.conversations.skills_ranking.service import ISkillsRankingService, SkillsRankingService
from app.server_dependencies.db_dependencies import CompassDBProvider

######################
# SkillsRankingRepository
######################

_skills_ranking_repository_singleton: ISkillsRankingRepository | None = None
_skills_ranking_repository_lock = asyncio.Lock()


async def get_skills_ranking_repository(
        application_db: AsyncIOMotorDatabase = Depends(
            CompassDBProvider.get_application_db)) -> ISkillsRankingRepository:
    """
    Get the instance of SkillsRankingRepository.
    """

    global _skills_ranking_repository_singleton

    # initial check to avoid the lock if the singleton instance is already created (lock is expensive)
    if _skills_ranking_repository_singleton is None:

        # before modifying the singleton instance, acquire the lock
        async with _skills_ranking_repository_lock:
            # double check after acquiring the lock
            if _skills_ranking_repository_singleton is None:
                _skills_ranking_repository_singleton = SkillsRankingRepository(application_db)

    return _skills_ranking_repository_singleton


######################
# SkillsRankingService
######################

_skills_ranking_service_singleton: ISkillsRankingService | None = None
_skills_ranking_service_lock = asyncio.Lock()


async def get_skills_ranking_service(
        repository: ISkillsRankingRepository = Depends(get_skills_ranking_repository)) -> ISkillsRankingService:
    global _skills_ranking_service_singleton

    # initial check to avoid the lock if the singleton instance is already created (lock is expensive)
    if _skills_ranking_service_singleton is None:

        # before modifying the singleton instance, acquire the lock
        async with _skills_ranking_service_lock:
            # double check after acquiring the lock
            if _skills_ranking_service_singleton is None:
                _skills_ranking_service_singleton = SkillsRankingService(repository)

    return _skills_ranking_service_singleton
