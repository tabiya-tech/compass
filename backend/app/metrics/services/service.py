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

            events, exception_group = await self._process_user_account_events(events)

            if exception_group:
                self._logger.error(f"Errors occurred while processing events: {exception_group}")

            await self._metrics_repository.record_event(events)
        except Exception as e:
            # Errors are swallowed and logged since we want the event service to be fire and forget and therefore cannot fail
            # callers should not handle exceptions from this service
            self._logger.exception(e)

    async def _process_user_account_events(self, events: list[AbstractCompassMetricEvent]) -> tuple[list[AbstractCompassMetricEvent], ExceptionGroup | None]:
        # Separate user account events from other events and collect user IDs
        user_account_events: list[tuple[str, AbstractUserAccountEvent]] = []
        other_events: list[AbstractCompassMetricEvent] = []
        errors: list[ValueError] = []
        
        for event in events:
            if isinstance(event, AbstractUserAccountEvent):
                if not event.user_id:
                    # we dont raise here since we want to process as many events as possible
                    errors.append(ValueError("User ID is required for user account events."))
                    continue
                # delete the user_id from the event
                user_id = event.user_id
                delattr(event, "user_id")
                user_account_events.append((user_id, event))
                # delete the session_id from the 
                if hasattr(event, "session_id"):
                    delattr(event, "session_id")
            else:
                other_events.append(event)
        
        # unzip the user_account_events
        user_ids, events = zip(*user_account_events) if user_account_events else ([], [])

        # Get all experiments in one batch
        if user_account_events:
            # user_ids doesn't have to be unique since the repository will handle that
            experiments_by_user = await self._user_preference_repository.get_experiments_by_user_ids(user_ids)

            # Attach experiments to events
            for user_id, event in user_account_events:
                event.relevant_experiments = experiments_by_user.get(user_id, {})

        # Return the combined set of events and any errors as an ExceptionGroup
        exception_group = ExceptionGroup("User account event processing errors", errors) if errors else None
        return list(events) + other_events, exception_group
