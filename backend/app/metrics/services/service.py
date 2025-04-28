from abc import ABC
import logging
from app.metrics.types import AbstractCompassMetricEvent, AbstractUserAccountEvent
from app.metrics.repository.repository import IMetricsRepository
from app.users.repositories import IUserPreferenceRepository


class IMetricsService(ABC):
    """
    Interface for the metrics service.
    """

    async def record_event(self, event: AbstractCompassMetricEvent, user_id: str | None):
        """
        Record an event. This is a fire and forget operation.
        The caller should not handle exceptions from this service as it will not throw any.
        :param event: The event to record.
        :param user_id: The original user ID to use for looking up experiments.
        """
        raise NotImplementedError()

    async def bulk_record_events(self, events: list[AbstractCompassMetricEvent], user_id: str | None):
        """
        Record a list of events. This is a fire and forget operation.
        The caller should not handle exceptions from this service as it will not throw any.
        :param events: The events to record.
        :param user_id: The original user ID to use for looking up experiments.
        """
        raise NotImplementedError()


class MetricsService(IMetricsService):
    """
    Implementation of the metrics service.
    """

    def __init__(self, repository: IMetricsRepository, user_preference_repository: IUserPreferenceRepository, enable_metrics: bool = True):
        self._metrics_repository = repository
        self._user_preference_repository = user_preference_repository
        self._logger = logging.getLogger(self.__class__.__name__)
        self.enable_metrics = enable_metrics
        if not self.enable_metrics:
            self._logger.warning("Metrics are disabled. Events will not be recorded.")

    async def record_event(self, event: AbstractCompassMetricEvent, user_id: str | None):
        await self.bulk_record_events([event], user_id)

    async def bulk_record_events(self, events: list[AbstractCompassMetricEvent], user_id: str | None):
        try:
            if not self.enable_metrics or len(events) == 0:
                return

            # For each event that is a user account event, set the relevant experiments
            # for now the experiments are tied to user preferences and can only include metrics from AbstractUserAccountEvent children
            for event in events:
                if isinstance(event, AbstractUserAccountEvent):
                    if not user_id:
                        raise ValueError("User ID is required for user account events.")

                    experiments = await self._user_preference_repository.get_experiments_by_user_id(user_id)
                    event.relevant_experiments = experiments

            await self._metrics_repository.record_event(events)
        except Exception as e:
            # Errors are swallowed and logged since we want the event service to be fire and forget and therefore cannot fail
            # callers should not handle exceptions from this service
            self._logger.exception(e)
