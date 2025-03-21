from abc import ABC
import logging
from app.metrics.types import CompassMetricEvent
from app.metrics.repository import ICompassMetricRepository
from app.app_config import get_application_config


class IMetricsService(ABC):
    """
    Interface for the metrics service.
    """
    async def record_event(self, event: CompassMetricEvent):
        """
        Record an event.
        :param event: The event to record.
        """
        raise NotImplementedError()


class MetricsService(IMetricsService):
    """
    Implementation of the metrics service.
    """
    def __init__(self, repository: ICompassMetricRepository):
        self._metrics_repository = repository
        self._logger = logging.getLogger(__name__)

    async def record_event(self, event: CompassMetricEvent):
        # TODO: add buffer to queue events and flush them to the repository
        if not get_application_config().enable_metrics:
            self._logger.warning("Metrics collection is disabled. Event will not be recorded.")
            return
        try:
            await self._metrics_repository.record_event([event])
        except Exception as e:
            # Errors are swallowed and logged since we want the event service to be fire and forget and therefore cannot fail
            # callers should not handle exceptions from this service
            self._logger.exception(e)
