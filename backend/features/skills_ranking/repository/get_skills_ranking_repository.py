import asyncio

from fastapi import Depends

from features.skills_ranking.repository.repository import ISkillsRankingRepository, SkillsRankingRepository
from features.skills_ranking.db_provider import SkillsRankingDBProvider

_skills_ranking_repository_singleton: ISkillsRankingRepository | None = None
_skills_ranking_repository_lock = asyncio.Lock()


async def get_skills_ranking_repository(
    db=Depends(SkillsRankingDBProvider.get_skills_ranking_db)
) -> ISkillsRankingRepository:
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
                _skills_ranking_repository_singleton = SkillsRankingRepository(db)

    return _skills_ranking_repository_singleton
