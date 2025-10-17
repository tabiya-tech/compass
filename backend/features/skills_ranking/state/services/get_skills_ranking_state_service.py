import asyncio

from fastapi import Depends

from app.application_state import IApplicationStateManager
from app.server_dependencies.application_state_dependencies import get_application_state_manager
from app.users.get_user_preferences_repository import get_user_preferences_repository
from app.users.repositories import IUserPreferenceRepository
from features.skills_ranking.config import get_skills_ranking_config
from features.skills_ranking.state.repositories.get_registration_data_repository import get_registration_data_repository
from features.skills_ranking.state.repositories.get_skills_ranking_state_repository import \
    get_skills_ranking_state_mongo_repository
from features.skills_ranking.state.repositories.skills_ranking_state_repository import ISkillsRankingStateRepository
from features.skills_ranking.services.skills_ranking_service import SkillsRankingService
from features.skills_ranking.state.repositories.types import IRegistrationDataRepository
from features.skills_ranking.state.services.skills_ranking_state_service import ISkillsRankingStateService, \
    SkillsRankingStateService

_skills_ranking_service_singleton: ISkillsRankingStateService | None = None
_skills_ranking_service_lock = asyncio.Lock()


async def get_skills_ranking_state_service(
        repository: ISkillsRankingStateRepository = Depends(get_skills_ranking_state_mongo_repository),
        user_preferences_repository: IUserPreferenceRepository = Depends(get_user_preferences_repository),
        registration_data_repository: IRegistrationDataRepository = Depends(get_registration_data_repository),
        application_state_manager: IApplicationStateManager = Depends(get_application_state_manager),
        high_difference_threshold: float = Depends(lambda: get_skills_ranking_config().high_difference_threshold),
        correct_rotations_threshold_for_group_switch: int = Depends(lambda: get_skills_ranking_config().correct_rotations_threshold_for_group_switch)
) -> ISkillsRankingStateService:
    global _skills_ranking_service_singleton

    # initial check to avoid the lock if the singleton instance is already created (lock is expensive)
    if _skills_ranking_service_singleton is None:

        # before modifying the singleton instance, acquire the lock
        async with _skills_ranking_service_lock:
            # double check after acquiring the lock
            if _skills_ranking_service_singleton is None:
                # Create skills ranking service instance
                config = get_skills_ranking_config()
                http_client = SkillsRankingService(
                    base_url=config.skills_ranking_service_url,
                    api_key=config.skills_ranking_service_api_key
                )
                
                _skills_ranking_service_singleton = SkillsRankingStateService(repository,
                                                                              user_preferences_repository,
                                                                              registration_data_repository,
                                                                              application_state_manager,
                                                                              http_client,
                                                                              high_difference_threshold,
                                                                              correct_rotations_threshold_for_group_switch)

    return _skills_ranking_service_singleton
