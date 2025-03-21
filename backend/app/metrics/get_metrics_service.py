import asyncio

from fastapi import Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.metrics.repository import MetricsRepository
from app.metrics.service import IMetricsService, MetricsService
from app.server_dependencies.db_dependencies import CompassDBProvider

# Lock to ensure that the singleton instance is thread-safe
_metrics_service_lock = asyncio.Lock()
_metrics_service_singleton: IMetricsService | None = None


async def get_metrics_service(application_db: AsyncIOMotorDatabase = Depends(CompassDBProvider.get_metrics_db)) -> IMetricsService:
    global _metrics_service_singleton
    if _metrics_service_singleton is None:  # initial check to avoid the lock if the singleton instance is already created (lock is expensive)
        async with _metrics_service_lock:  # before modifying the singleton instance, acquire the lock
            if _metrics_service_singleton is None:  # double check after acquiring the lock
                _metrics_service_singleton = MetricsService(
                    repository=MetricsRepository(db=application_db)
                )
    return _metrics_service_singleton
