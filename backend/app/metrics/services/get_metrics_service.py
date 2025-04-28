import asyncio

from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.app_config import get_application_config, ApplicationConfig
from app.metrics.repository.repository import MetricsRepository
from app.metrics.services.service import IMetricsService, MetricsService
from app.server_dependencies.db_dependencies import CompassDBProvider
from app.users.get_user_preferences_repository import get_user_preferences_repository

# Lock to ensure that the singleton instance is thread-safe
_metrics_service_lock = asyncio.Lock()
_metrics_service_singleton: IMetricsService | None = None


async def get_metrics_service(application_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_metrics_db),
                              app_config: ApplicationConfig = Depends(get_application_config),
                              user_preference_repository=Depends(get_user_preferences_repository)
                              ) -> IMetricsService:
    global _metrics_service_singleton
    if _metrics_service_singleton is None:  # initial check to avoid the lock if the singleton instance is already created (lock is expensive)
        async with _metrics_service_lock:  # before modifying the singleton instance, acquire the lock
            if _metrics_service_singleton is None:  # double check after acquiring the lock
                _metrics_service_singleton = MetricsService(
                    repository=MetricsRepository(db=application_db),
                    user_preference_repository=user_preference_repository,
                    enable_metrics=app_config.enable_metrics
                )
    return _metrics_service_singleton
