import asyncio

from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from features.skills_ranking.config import get_skills_ranking_config
from features.skills_ranking.state.repositories.get_skills_ranking_state_db import get_skills_ranking_state_db
from features.skills_ranking.state.repositories.skills_ranking_state_repository import SkillsRankingStateRepository
from features.skills_ranking.state.repositories.types import ISkillsRankingStateRepository

_skills_ranking_repository_singleton: ISkillsRankingStateRepository | None = None
_skills_ranking_repository_lock = asyncio.Lock()


async def get_skills_ranking_state_mongo_repository(db: AsyncIOMotorDatabase = Depends(get_skills_ranking_state_db),
                                                    collection_name: str = Depends(
                                                  lambda: get_skills_ranking_config().skills_ranking_state_collection_name)) -> ISkillsRankingStateRepository:
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
                _skills_ranking_repository_singleton = SkillsRankingStateRepository(db, collection_name)

    return _skills_ranking_repository_singleton
