from abc import ABC
import logging

from click import Tuple

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

            await self._process_user_account_events(events)

            await self._metrics_repository.record_event(events)
        except Exception as e:
            # Errors are swallowed and logged since we want the event service to be fire and forget and therefore cannot fail
            # callers should not handle exceptions from this service
            self._logger.exception(e)

    async def _process_user_account_events(self, events: list[AbstractCompassMetricEvent]):
        # Separate user account events from other events and collect user IDs
        user_account_events: list[AbstractUserAccountEvent] = []
        user_ids: list[str] = []
        errors: list[ValueError] = []

        for event in events:
            # delete the session_id attribute from the event object, if it exists
            if hasattr(event, "session_id"):
                delattr(event, "session_id")

            # build a list of the user_ids and the user_account_events
            if isinstance(event, AbstractUserAccountEvent):
                if not event.user_id:
                    # we dont raise here since we want to process as many events as possible
                    errors.append(ValueError("User ID is required for user account events."))
                    continue
                user_ids.append(event.user_id)
                user_account_events.append(event)

        # for all the user_account_events that have a user_id, attach the experiments and delete the user_id
        if len(user_account_events) > 0:
            # user_ids doesn't have to be unique since the repository will handle that
            experiments_by_user = await self._user_preference_repository.get_experiments_by_user_ids(user_ids)

            # Attach experiments to events
            for event in user_account_events:
                event.relevant_experiments = experiments_by_user.get(event.user_id, {})
                # delete the user_id from the event
                delattr(event, "user_id")
        if len(errors) > 0:
            self._logger.error(f"Errors occurred while processing events: {ExceptionGroup('User account event processing errors', errors)}")
