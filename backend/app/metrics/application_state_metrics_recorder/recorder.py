import logging
from abc import ABC, abstractmethod
from typing import cast

from app.application_state import ApplicationState, IApplicationStateManager
from app.metrics.application_state_metrics_recorder.types import ApplicationStatesOfInterest
from app.metrics.services.service import IMetricsService
from app.metrics.types import ConversationPhaseEvent, ConversationTurnEvent, \
    AbstractCompassMetricEvent, ConversationPhaseLiteral, ExperienceDiscoveredEvent, ExperienceExploredEvent


class IApplicationStateMetricsRecorder(ABC):
    """
    Interface for the application state metrics recorder.
    This class is responsible for recording metrics based on state changes.
    """

    @abstractmethod
    async def get_state(self, session_id: int) -> ApplicationState:
        """
        Get the application state for a session.
        If the state does not exist, a new state is created and stored.
        """
        pass

    @abstractmethod
    async def save_state(self, state: ApplicationState, user_id: str) -> None:
        """
        Save the application state for a session and record any metric events.
        """
        pass

    @abstractmethod
    async def delete_state(self, session_id: int) -> None:
        """
        Delete the application state for a session.
        """
        pass


class ApplicationStateMetricsRecorder(IApplicationStateMetricsRecorder):
    """
    Implementation of the application state metrics recorder.
    This class is responsible for recording metrics based on state changes.
    """

    def __init__(self, *,
                 application_state_manager: IApplicationStateManager,
                 metrics_service: IMetricsService):
        """
        Initialize the application state metrics recorder.
        
        Args:
            application_state_manager: The application state manager to use for state operations.
            metrics_service: Optional metrics service to record metrics. If None, metrics will not be recorded.
        """
        self._application_state_manager = application_state_manager
        self._metrics_service = metrics_service
        self.logger = logging.getLogger(self.__class__.__name__)
        self._previous_state: ApplicationStatesOfInterest | None = None

    async def get_state(self, session_id: int) -> ApplicationState:
        """
        Get the application state for a session.
        If the state does not exist, a new state is created and stored.
        Also sets the state tracking variables based on the current state.
        """
        # if the saving state fails, we want the error to propagate and handle it in the caller
        state = await self._application_state_manager.get_state(session_id)
        try:
            # if the parsing of the state fails, however, we want to log and move on since
            # the metrics are not critical to the application
            self._previous_state = ApplicationStatesOfInterest.from_state(state)
        except Exception as e:
            self.logger.exception("Failed to parse state for session %s", session_id, exc_info=e)
        return state

    async def save_state(self, state: ApplicationState, user_id: str) -> None:
        """
        Save the application state for a session and record any metric events.
        """
        # if saving state fails, we want the error to propagate and handle it in the caller
        await self._application_state_manager.save_state(state)
        if self._previous_state is not None:
            try:
                # if the parsing of the state fails, we want to log and move on since
                # the metrics are not critical to the application
                current_state = ApplicationStatesOfInterest.from_state(state)
                await self.record_metric_events(self._previous_state, current_state, state.session_id, user_id)
                self._previous_state = current_state
            except Exception as e:
                # We don't want to fail the entire application if recording metric events fails
                # so we catch the exception and log it
                self.logger.exception("Failed to record metric events for user %s", user_id, exc_info=e)

    async def delete_state(self, session_id: int) -> None:
        """
        Delete the application state for a session.
        """
        await self._application_state_manager.delete_state(session_id)

    async def record_metric_events(
            self,
            previous_state: ApplicationStatesOfInterest,
            current_state: ApplicationStatesOfInterest,
            session_id: int,
            user_id: str
    ):
        """
        Record metric events based on the changes between the previous and current state.
        """
        events: list[AbstractCompassMetricEvent] = []

        # Record count changes
        if current_state.user_message_count != previous_state.user_message_count or current_state.compass_message_count != previous_state.compass_message_count:
            events.append(ConversationTurnEvent(
                user_id=user_id,
                session_id=session_id,
                user_message_count=current_state.user_message_count,
                compass_message_count=current_state.compass_message_count
            ))

        # Record experience discovered changes
        if previous_state.experiences_by_work_type != current_state.experiences_by_work_type:
            events.append(ExperienceDiscoveredEvent(
                user_id=user_id,
                session_id=session_id,
                experience_count=current_state.experiences_discovered_count,
                experiences_by_work_type=current_state.experiences_by_work_type
            ))

        # Record experience exploration changes
        # Record experience explored changes
        if previous_state.experiences_explored_by_work_type != current_state.experiences_explored_by_work_type:
            events.append(ExperienceExploredEvent(
                user_id=user_id,
                session_id=session_id,
                experience_count=current_state.experiences_explored_count,
                experiences_by_work_type=current_state.experiences_explored_by_work_type
            ))

        # Record conversation phase changes
        if previous_state.conversation_phase != current_state.conversation_phase:
            events.append(ConversationPhaseEvent(
                user_id=user_id,
                session_id=session_id,
                phase=cast(ConversationPhaseLiteral, current_state.conversation_phase)
            ))

        # Record counseling phase changes
        # We are not interested in the "ENDED" phase for the counseling phase
        if (previous_state.counseling_phase != current_state.counseling_phase and
                current_state.counseling_phase != "ENDED"):
            events.append(ConversationPhaseEvent(
                user_id=user_id,
                session_id=session_id,
                phase=cast(ConversationPhaseLiteral, current_state.counseling_phase)
            ))

        # Record all events if there are any
        if events:
            await self._metrics_service.bulk_record_events(events)
