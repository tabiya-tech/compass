from abc import ABC
import logging
from app.metrics.types import AbstractCompassMetricEvent
from app.metrics.repository.repository import IMetricsRepository


class IMetricsService(ABC):
    """
    Interface for the metrics service.
    """

    async def record_event(self, event: AbstractCompassMetricEvent):
        """
        Record an event. This is a fire and forget operation.
        The caller should not handle exceptions from this service as it will not throw any.
        :param event: The event to record.
        """
        raise NotImplementedError()

    async def bulk_record_events(self, events: list[AbstractCompassMetricEvent]):
        """
        Record a list of events. This is a fire and forget operation.
        The caller should not handle exceptions from this service as it will not throw any.
        :param events: The events to record.
        """
        raise NotImplementedError()


class MetricsService(IMetricsService):
    """
    Implementation of the metrics service.
    """

    def __init__(self, repository: IMetricsRepository, enable_metrics: bool = True):
        self._metrics_repository = repository
        self._logger = logging.getLogger(self.__class__.__name__)
        self.enable_metrics = enable_metrics
        if not self.enable_metrics:
            self._logger.warning("Metrics are disabled. Events will not be recorded.")

    async def record_event(self, event: AbstractCompassMetricEvent):
        await self.bulk_record_events([event])

    async def bulk_record_events(self, events: list[AbstractCompassMetricEvent]):
        try:
            if not self.enable_metrics or len(events) == 0:
                return
            await self._metrics_repository.record_event(events)
        except Exception as e:
            # Errors are swallowed and logged since we want the event service to be fire and forget and therefore cannot fail
            # callers should not handle exceptions from this service
            self._logger.exception(e)
