from abc import ABC
import logging
from app.metrics.types import AbstractCompassMetricEvent, AbstractUserAccountEvent
from app.metrics.repository.repository import IMetricsRepository
from app.users.repositories import IUserPreferenceRepository


class IMetricsService(ABC):
    """
    Interface for the metrics service.
    """

    async def record_event(self, event: AbstractCompassMetricEvent):
        """
        Record an event. This is a fire and forget operation.
        The caller should not handle exceptions from this service as it will not throw any.
        :param event: The event to record.
        :param user_id: The original user ID to use for looking up experiments.
        """
        raise NotImplementedError()

    async def bulk_record_events(self, events: list[AbstractCompassMetricEvent]):
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

    async def record_event(self, event: AbstractCompassMetricEvent):
        await self.bulk_record_events([event])

    async def bulk_record_events(self, events: list[AbstractCompassMetricEvent]):
        try:
            if not self.enable_metrics or len(events) == 0:
                return

            # Collect user IDs from user account events
            user_ids = []
            user_account_events = []
            for event in events:
                if isinstance(event, AbstractUserAccountEvent):
                    if not event.user_id:
                        raise ValueError("User ID is required for user account events.")
                    user_ids.append(event.user_id)
                    user_account_events.append(event)

            # Get all experiments in one batch
            if user_ids:
                experiments_by_user = await self._user_preference_repository.get_experiments_by_user_ids(user_ids)
                
                # Attach experiments to events
                for event in user_account_events:
                    event.relevant_experiments = experiments_by_user.get(event.user_id, {})

            for event in events:
                # delete the user_id from the event
                if hasattr(event, 'user_id'):
                    delattr(event, 'user_id')
                # delete the session_id from the event
                if hasattr(event, 'session_id'):
                    delattr(event, 'session_id')

            await self._metrics_repository.record_event(events)
        except Exception as e:
            # Errors are swallowed and logged since we want the event service to be fire and forget and therefore cannot fail
            # callers should not handle exceptions from this service
            self._logger.exception(e)
