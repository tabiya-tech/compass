import asyncio

from fastapi import Depends

from app.users.get_user_preferences_repository import get_user_preferences_repository
from app.users.repositories import IUserPreferenceRepository
from features.skills_ranking.repository.get_skills_ranking_repository import get_skills_ranking_repository
from features.skills_ranking.repository.repository import ISkillsRankingRepository
from features.skills_ranking.service.service import ISkillsRankingService, SkillsRankingService

_skills_ranking_service_singleton: ISkillsRankingService | None = None
_skills_ranking_service_lock = asyncio.Lock()


async def get_skills_ranking_service(
        repository: ISkillsRankingRepository = Depends(get_skills_ranking_repository),
        user_preferences_repository: IUserPreferenceRepository = Depends(get_user_preferences_repository)) -> ISkillsRankingService:
    global _skills_ranking_service_singleton

    # initial check to avoid the lock if the singleton instance is already created (lock is expensive)
    if _skills_ranking_service_singleton is None:

        # before modifying the singleton instance, acquire the lock
        async with _skills_ranking_service_lock:
            # double check after acquiring the lock
            if _skills_ranking_service_singleton is None:
                _skills_ranking_service_singleton = SkillsRankingService(repository, user_preferences_repository)

    return _skills_ranking_service_singleton
