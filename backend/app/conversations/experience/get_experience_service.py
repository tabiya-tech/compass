import asyncio

from fastapi import Depends

from app.application_state import ApplicationStateManager
from app.conversations.experience.get_experience_repository import get_experience_repository
from app.conversations.experience.repository import IExperiencesRepository
from app.conversations.experience.service import IExperienceService, ExperienceService
from app.metrics.application_state_metrics_recorder.recorder import ApplicationStateMetricsRecorder
from app.metrics.services.get_metrics_service import get_metrics_service
from app.metrics.services.service import IMetricsService
from app.server_dependencies.application_state_dependencies import get_application_state_manager

_experience_service_singleton: IExperienceService | None = None
_experience_service_lock = asyncio.Lock()


async def get_experience_service(
        application_state_manager: ApplicationStateManager = Depends(get_application_state_manager),
        experiences_repository: IExperiencesRepository = Depends(get_experience_repository),
        metrics_service: IMetricsService = Depends(get_metrics_service)) -> IExperienceService:
    global _experience_service_singleton

    # initial check to avoid the lock if the singleton instance is already created (lock is expensive)
    if _experience_service_singleton is None:

        # before modifying the singleton instance, acquire the lock
        async with _experience_service_lock:
            # double check after acquiring the lock
            if _experience_service_singleton is None:
                app_state_recorder = ApplicationStateMetricsRecorder(
                    application_state_manager=application_state_manager,
                    metrics_service=metrics_service
                )
                _experience_service_singleton = ExperienceService(
                    application_state_metrics_recorder=app_state_recorder,
                    metrics_service=metrics_service,
                    experiences_repository=experiences_repository,
                )

    return _experience_service_singleton
