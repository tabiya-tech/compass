import random

import pytest
from unittest.mock import AsyncMock
from typing import cast
from datetime import datetime, timezone

from app.agent.agent_director.abstract_agent_director import ConversationPhase
from app.agent.experience import ExperienceEntity
from app.agent.explore_experiences_agent_director import ConversationPhase as CounselingPhase, ExperienceState
from app.agent.agent_types import AgentInput, AgentOutput
from app.agent.explore_experiences_agent_director import DiveInPhase
from app.app_config import ApplicationConfig
from app.application_state import ApplicationState, IApplicationStateManager
from app.conversation_memory.conversation_memory_types import (
    ConversationTurn
)
from app.metrics.application_state_metrics_recorder.recorder import ApplicationStateMetricsRecorder
from app.metrics.application_state_metrics_recorder.types import ApplicationStatesOfInterest, _CounselingPhaseLiteral, \
    _ConversationPhaseLiteral
from app.metrics.services.service import IMetricsService
from app.metrics.types import (
    ConversationPhaseEvent,
    ConversationTurnEvent,
    AbstractCompassMetricEvent, ExperienceDiscoveredEvent, ExperienceExploredEvent
)
from common_libs.test_utilities import get_random_session_id, get_random_user_id, get_random_printable_string


@pytest.fixture
def mock_metrics_service() -> IMetricsService:
    class MockedMetricsService(IMetricsService):
        async def bulk_record_events(self, events: list[AbstractCompassMetricEvent]):
            raise NotImplementedError()

    return MockedMetricsService()


@pytest.fixture
def mock_application_state_manager() -> IApplicationStateManager:
    """Fixture that provides an application state manager with an empty state"""

    class MockedApplicationStateManager(IApplicationStateManager):
        async def get_state(self, session_id: int) -> ApplicationState:
            raise NotImplementedError()

        async def save_state(self, state: ApplicationState):
            raise NotImplementedError()

        async def delete_state(self, session_id: int):
            raise NotImplementedError()

        async def get_all_session_ids(self):
            raise NotImplementedError()

    manager = MockedApplicationStateManager()
    return manager


class TestRecorderFlow:
    @pytest.mark.asyncio
    async def test_record_single_change(
            self,
            mock_metrics_service: IMetricsService,
            mock_application_state_manager: IApplicationStateManager,
            setup_application_config: ApplicationConfig
    ):
        # GIVEN a metrics service that successfully records events
        mock_metrics_service.bulk_record_events = AsyncMock()

        # AND a user and session id
        given_user_id = get_random_user_id()
        given_session_id = get_random_session_id()

        # AND a new state with some change
        given_new_state = ApplicationState.new_state(given_session_id)
        given_new_state.agent_director_state.current_phase = ConversationPhase.COUNSELING

        # AND the application state manager returns an empty state
        mock_application_state_manager.get_state = AsyncMock(
            return_value=ApplicationState.new_state(given_session_id))
        # AND the application state manager's save_state method will succeed
        mock_application_state_manager.save_state = AsyncMock()

        # WHEN get state is called for a session with no previous state
        recorder = ApplicationStateMetricsRecorder(
            application_state_manager=mock_application_state_manager,
            metrics_service=mock_metrics_service
        )
        await recorder.get_state(session_id=given_session_id)

        # AND save state is called with the new state
        await recorder.save_state(given_new_state, user_id=given_user_id)

        # THEN expect the metrics service to have been called with events
        mock_metrics_service.bulk_record_events.assert_called_once()

        # AND  the application state manager save_state method to have been called
        mock_application_state_manager.save_state.assert_called_once_with(given_new_state)

    @pytest.mark.asyncio
    async def test_multiple_changes_recorded_together(
            self,
            mock_metrics_service: IMetricsService,
            mock_application_state_manager: IApplicationStateManager,
            setup_application_config: ApplicationConfig
    ):
        # GIVEN a metrics service that successfully records events
        mock_metrics_service.bulk_record_events = AsyncMock()
        # AND a user id
        given_user_id = get_random_user_id()
        # AND a session id
        given_session_id = get_random_session_id()

        # AND the application state manager returns an empty state
        mock_application_state_manager.get_state = AsyncMock(
            return_value=ApplicationState.new_state(given_session_id))

        # AND the application state manager's save_state method will succeed
        mock_application_state_manager.save_state = AsyncMock()

        # WHEN the recorder is asked to get a state for a session with no previous state
        recorder = ApplicationStateMetricsRecorder(
            application_state_manager=mock_application_state_manager,
            metrics_service=mock_metrics_service
        )
        await recorder.get_state(given_session_id)

        # AND a save state happens with multiple changes
        given_new_state = ApplicationState.new_state(given_session_id)
        # Add a message turn with a user and compass message
        given_new_state.conversation_memory_manager_state.all_history.turns.append(
            ConversationTurn(
                index=0,
                input=AgentInput(
                    message="Hi",
                    is_artificial=False,
                    sent_at=datetime.now(timezone.utc)
                ),
                output=AgentOutput(
                    message_for_user="Hello",
                    finished=True,
                    agent_response_time_in_sec=1.0,
                    llm_stats=[],
                    sent_at=datetime.now(timezone.utc)
                )
            )
        )
        # Change conversation phase
        given_new_state.agent_director_state.current_phase = ConversationPhase.COUNSELING
        # Change counseling phase
        given_new_state.explore_experiences_director_state.conversation_phase = CounselingPhase.DIVE_IN
        # Add a discovered experience
        given_experience = ExperienceEntity(
            uuid=get_random_printable_string(10),
            experience_title="Test Experience",
        )
        # and the discovered experience is explored
        experience_state = ExperienceState(
            dive_in_phase=DiveInPhase.PROCESSED,
            experience=given_experience
        )
        given_new_state.explore_experiences_director_state.experiences_state = {given_experience.uuid: experience_state}

        await recorder.save_state(given_new_state, given_user_id)

        # THEN all events should be recorded with specific state changes
        mock_metrics_service.bulk_record_events.assert_called_once()
        events = mock_metrics_service.bulk_record_events.call_args[0][0]

        # AND the metrics service should have recorded the following events:
        # - 1 conversation turn event
        # - 2 conversation phase events (one for the main conversation phase and one for the counseling phase)
        # - 1 experience exploration event (one for the dive in phase)
        assert len(events) == 5
        conversation_phase_events = [e for e in events if isinstance(e, ConversationPhaseEvent)]

        # AND a conversation turn event should be recorded
        assert isinstance(events[0], ConversationTurnEvent)
        assert events[0].compass_message_count == 1
        assert events[0].user_message_count == 1

        # AND there should be 1 experience discovered event
        assert isinstance(events[1], ExperienceDiscoveredEvent)
        assert events[1].experience_count == 1

        # AND there should be 1 experience explored event
        assert isinstance(events[2], ExperienceExploredEvent)
        assert events[2].experience_count == 1

        # AND there should be 2 conversation phase events (1 for the main conversation phase, 1 for the counseling phase)
        assert len(conversation_phase_events) == 2
        # AND the main conversation phase should be recorded
        assert conversation_phase_events[0].phase == given_new_state.agent_director_state.current_phase.name
        # AND the counseling phase should be recorded
        assert conversation_phase_events[1].phase == given_new_state.explore_experiences_director_state.conversation_phase.name

        # AND the application state should be saved
        mock_application_state_manager.save_state.assert_called_once_with(given_new_state)

    @pytest.mark.asyncio
    async def test_metrics_service_error_does_not_affect_state_saving(
            self,
            mock_metrics_service: IMetricsService,
            mock_application_state_manager: IApplicationStateManager,
            setup_application_config: ApplicationConfig
    ):
        # GIVEN a metrics service that raises an error
        mock_metrics_service.bulk_record_events = AsyncMock(side_effect=Exception("Test error"))
        # AND a user id
        given_user_id = get_random_user_id()
        # AND a session id
        given_session_id = get_random_session_id()

        # AND the application state manager returns an empty state
        mock_application_state_manager.get_state = AsyncMock(
            return_value=ApplicationState.new_state(given_session_id))
        recorder = ApplicationStateMetricsRecorder(
            application_state_manager=mock_application_state_manager,
            metrics_service=mock_metrics_service
        )
        # AND the application state manager's save_state method will succeed
        mock_application_state_manager.save_state = AsyncMock()

        # WHEN the recorder is asked to get a state for a session with no previous state
        await recorder.get_state(given_session_id)

        # AND a save state happens with a new state
        given_new_state = ApplicationState.new_state(given_session_id)
        given_new_state.agent_director_state.current_phase = ConversationPhase.COUNSELING
        await recorder.save_state(given_new_state, given_user_id)

        # THEN the application state should still be saved despite the metrics error
        mock_application_state_manager.save_state.assert_called_once_with(given_new_state)

    @pytest.mark.asyncio
    async def test_from_state_error_does_not_affect_state_saving(
            self,
            mock_metrics_service: IMetricsService,
            mock_application_state_manager: IApplicationStateManager,
            setup_application_config: ApplicationConfig
    ):
        # GIVEN a user id
        given_user_id = get_random_user_id()
        # AND a session id
        given_session_id = get_random_session_id()

        # AND the application state manager returns an empty state
        mock_application_state_manager.get_state = AsyncMock(
            return_value=ApplicationState.new_state(given_session_id))

        # AND the application state manager's save_state method will succeed
        mock_application_state_manager.save_state = AsyncMock()

        # WHEN the recorder is asked to get a state for a session with no previous state
        recorder = ApplicationStateMetricsRecorder(
            application_state_manager=mock_application_state_manager,
            metrics_service=mock_metrics_service
        )
        await recorder.get_state(given_session_id)

        # AND a save state happens with an invalid state that will cause the ApplicationStatesOfInterest.from_state method to raise an error
        given_new_state = ApplicationState.new_state(given_session_id)
        # noinspection PyTypeChecker
        given_new_state.agent_director_state.current_phase = "INVALID_PHASE"
        await recorder.save_state(given_new_state, given_user_id)

        # THEN the application state should still be saved despite the metrics error
        mock_application_state_manager.save_state.assert_called_once_with(given_new_state)


class TestRecordMetricEventsFunction:
    @pytest.mark.asyncio
    async def test_record_metric_events_conversation_turn_event_from_empty_state(
            self,
            mock_metrics_service: IMetricsService,
            mock_application_state_manager: IApplicationStateManager,
            setup_application_config: ApplicationConfig):
        # GIVEN a metrics service that successfully records events
        mock_metrics_service.bulk_record_events = AsyncMock()
        # AND a session_id
        session_id = get_random_session_id()
        # AND a user_id
        user_id = get_random_user_id()

        # AND an empty previous state
        given_previous_state = ApplicationStatesOfInterest(
            conversation_phase="NOT_STARTED",
            counseling_phase="NOT_STARTED",
            compass_message_count=1,
            user_message_count=1,
            experiences_explored_count=0,
            experiences_discovered_count=0,
            work_types_discovered=[]
        )
        # AND a current state with a message turn
        given_current_state = ApplicationStatesOfInterest(
            conversation_phase="NOT_STARTED",
            counseling_phase="NOT_STARTED",
            compass_message_count=given_previous_state.compass_message_count + random.randint(1, 10),  # nosec B311 # random is used for testing purposes
            user_message_count=given_previous_state.user_message_count + random.randint(1, 10),  # nosec B311 # random is used for testing purposes
            experiences_explored_count=0,
            experiences_discovered_count=0,
            work_types_discovered=[]
        )
        # WHEN the record_metric_events function is called with a previous state, current state, session_id and user_id
        recorder = ApplicationStateMetricsRecorder(
            application_state_manager=mock_application_state_manager,
            metrics_service=mock_metrics_service
        )
        await recorder.record_metric_events(given_previous_state, given_current_state, session_id, user_id)
        # THEN the metrics service should have been called with the expected events
        mock_metrics_service.bulk_record_events.assert_called_once()
        events = mock_metrics_service.bulk_record_events.call_args[0][0]
        # AND there should be 1 message event
        assert len(events) == 1
        # AND the first event should be the user message
        assert events[0].compass_message_count == given_current_state.compass_message_count
        assert events[0].user_message_count == given_current_state.user_message_count

    @pytest.mark.asyncio
    async def test_record_metric_events_conversation_turn_event_from_previous_state_with_messages(
            self,
            mock_metrics_service: IMetricsService,
            mock_application_state_manager: IApplicationStateManager,
            setup_application_config: ApplicationConfig
    ):
        # GIVEN a metrics service that successfully records events
        mock_metrics_service.bulk_record_events = AsyncMock()
        # AND a session_id
        session_id = get_random_session_id()
        # AND a user_id
        user_id = get_random_user_id()

        # AND a previous state with 1 user message and 1 compass message
        given_previous_state = ApplicationStatesOfInterest(
            conversation_phase="NOT_STARTED",
            counseling_phase="NOT_STARTED",
            compass_message_count=1,
            user_message_count=2,
            experiences_explored_count=0,
            experiences_discovered_count=0,
            work_types_discovered=[]
        )
        # AND a current state with 2 user messages and 2 compass messages
        given_current_state = ApplicationStatesOfInterest(
            conversation_phase="NOT_STARTED",
            counseling_phase="NOT_STARTED",
            compass_message_count=3,
            user_message_count=4,
            experiences_explored_count=0,
            experiences_discovered_count=0,
            work_types_discovered=[]
        )
        # WHEN the record_metric_events function is called with a previous state, current state, session_id and user_id
        recorder = ApplicationStateMetricsRecorder(
            application_state_manager=mock_application_state_manager,
            metrics_service=mock_metrics_service
        )
        await recorder.record_metric_events(given_previous_state, given_current_state, session_id, user_id)
        # THEN the metrics service should have been called with the expected events
        mock_metrics_service.bulk_record_events.assert_called_once()
        events = mock_metrics_service.bulk_record_events.call_args[0][0]
        # AND there should be 1 conversation turn event
        assert len(events) == 1
        # AND the conversation turn event should have 2 user messages and 2 compass messages
        assert events[0].compass_message_count == 3
        assert events[0].user_message_count == 4

    @pytest.mark.asyncio
    async def test_record_metric_events_conversation_turn_event_from_previous_state_with_no_changes(
            self,
            mock_metrics_service: IMetricsService,
            mock_application_state_manager: IApplicationStateManager,
            setup_application_config: ApplicationConfig
    ):
        # GIVEN a metrics service that successfully records events
        mock_metrics_service.bulk_record_events = AsyncMock()
        # AND a session_id
        session_id = get_random_session_id()
        # AND a user_id
        user_id = get_random_user_id()

        # AND a previous state with 1 user message and 1 compass message
        given_previous_state = ApplicationStatesOfInterest(
            conversation_phase="NOT_STARTED",
            counseling_phase="NOT_STARTED",
            compass_message_count=1,
            user_message_count=2,
            experiences_explored_count=0,
            experiences_discovered_count=0,
            work_types_discovered=[]
        )
        # AND a current state with 1 user message and 1 compass message
        given_current_state = ApplicationStatesOfInterest(
            conversation_phase="NOT_STARTED",
            counseling_phase="NOT_STARTED",
            compass_message_count=1,  # no change
            user_message_count=2,  # no change
            experiences_explored_count=0,
            experiences_discovered_count=0,
            work_types_discovered=[]
        )
        # WHEN the record_metric_events function is called with a previous state, current state, session_id and user_id
        recorder = ApplicationStateMetricsRecorder(
            application_state_manager=mock_application_state_manager,
            metrics_service=mock_metrics_service
        )
        await recorder.record_metric_events(given_previous_state, given_current_state, session_id, user_id)
        # THEN the metrics service should not have been called
        mock_metrics_service.bulk_record_events.assert_not_called()

    @pytest.mark.asyncio
    @pytest.mark.parametrize("given_conversation_phase", ["INTRO", "COUNSELING", "CHECKOUT", "ENDED"])
    async def test_record_metric_events_conversation_phase_changed_from_empty_state(
            self,
            given_conversation_phase: str,
            mock_metrics_service: IMetricsService,
            mock_application_state_manager: IApplicationStateManager,
            setup_application_config: ApplicationConfig
    ):
        # GIVEN a metrics service that successfully records events
        mock_metrics_service.bulk_record_events = AsyncMock()
        # AND a session_id
        session_id = get_random_session_id()
        # AND a user_id
        user_id = get_random_user_id()

        # AND an empty previous state
        given_previous_state = ApplicationStatesOfInterest(
            conversation_phase="NOT_STARTED",
            counseling_phase="NOT_STARTED",
            compass_message_count=0,
            user_message_count=0,
            experiences_explored_count=0,
            experiences_discovered_count=0,
            work_types_discovered=[]
        )
        # AND a current state with a conversation phase
        given_current_state = ApplicationStatesOfInterest(
            conversation_phase=cast(_ConversationPhaseLiteral, given_conversation_phase),
            counseling_phase="NOT_STARTED",
            compass_message_count=0,
            user_message_count=0,
            experiences_explored_count=0,
            experiences_discovered_count=0,
            work_types_discovered=[]
        )

        # WHEN the record_metric_events function is called with a previous state, current state, session_id and user_id
        recorder = ApplicationStateMetricsRecorder(
            application_state_manager=mock_application_state_manager,
            metrics_service=mock_metrics_service
        )
        await recorder.record_metric_events(given_previous_state, given_current_state, session_id, user_id)
        # THEN the metrics service should have been called with the expected events
        mock_metrics_service.bulk_record_events.assert_called_once()
        events = mock_metrics_service.bulk_record_events.call_args[0][0]
        # AND there should be 1 conversation phase event
        assert len(events) == 1
        # AND the conversation phase event should be the main conversation phase
        assert events[0].phase == given_current_state.conversation_phase

    @pytest.mark.asyncio
    @pytest.mark.parametrize("given_counseling_phase", ["COLLECT_EXPERIENCES", "DIVE_IN"])
    async def test_record_metric_events_counseling_phase_changed_from_empty_state(
            self,
            given_counseling_phase: str,
            mock_metrics_service: IMetricsService,
            mock_application_state_manager: IApplicationStateManager,
            setup_application_config: ApplicationConfig
    ):
        # GIVEN a metrics service that successfully records events
        mock_metrics_service.bulk_record_events = AsyncMock()
        # AND a session_id
        session_id = get_random_session_id()
        # AND a user_id
        user_id = get_random_user_id()

        # AND an empty previous state
        given_previous_state = ApplicationStatesOfInterest(
            conversation_phase="COUNSELING",  # we should start out as counseling to isolate the counseling phase change
            counseling_phase="NOT_STARTED",
            compass_message_count=0,
            user_message_count=0,
            experiences_explored_count=0,
            experiences_discovered_count=0,
            work_types_discovered=[]
        )
        # AND a current state with a conversation phase
        given_current_state = ApplicationStatesOfInterest(
            conversation_phase="COUNSELING",
            counseling_phase=cast(_CounselingPhaseLiteral, given_counseling_phase),
            compass_message_count=0,
            user_message_count=0,
            experiences_explored_count=0,
            experiences_discovered_count=0,
            work_types_discovered=[]
        )
        # WHEN the record_metric_events function is called with a previous state, current state, session_id and user_id
        recorder = ApplicationStateMetricsRecorder(
            application_state_manager=mock_application_state_manager,
            metrics_service=mock_metrics_service
        )
        await recorder.record_metric_events(given_previous_state, given_current_state, session_id, user_id)

        # THEN the metrics service should have been called with the expected events
        mock_metrics_service.bulk_record_events.assert_called_once()
        events = mock_metrics_service.bulk_record_events.call_args[0][0]
        # AND there should be 1 conversation phase event
        assert len(events) == 1
        # AND the conversation phase event should be the main conversation phase
        print(events)
        assert events[0].phase == given_current_state.counseling_phase

    @pytest.mark.asyncio
    async def test_record_metric_events_experience_explored_from_empty_state(
            self,
            mock_metrics_service: IMetricsService,
            mock_application_state_manager: IApplicationStateManager,
            setup_application_config: ApplicationConfig
    ):
        # GIVEN a metrics service that successfully records events
        mock_metrics_service.bulk_record_events = AsyncMock()
        # AND a session_id
        session_id = get_random_session_id()
        # AND a user_id
        user_id = get_random_user_id()

        # AND an empty previous state
        given_previous_state = ApplicationStatesOfInterest(
            conversation_phase="NOT_STARTED",
            counseling_phase="NOT_STARTED",
            compass_message_count=0,
            user_message_count=0,
            experiences_explored_count=0,
            experiences_discovered_count=0,
            work_types_discovered=[]
        )
        # AND a current state with an explored experience
        given_current_state = ApplicationStatesOfInterest(
            conversation_phase="NOT_STARTED",
            counseling_phase="NOT_STARTED",
            compass_message_count=0,
            user_message_count=0,
            experiences_explored_count=1,
            experiences_discovered_count=0,
            work_types_discovered=[]
        )

        # WHEN the record_metric_events function is called with a previous state, current state, session_id and user_id
        recorder = ApplicationStateMetricsRecorder(
            application_state_manager=mock_application_state_manager,
            metrics_service=mock_metrics_service
        )
        await recorder.record_metric_events(given_previous_state, given_current_state, session_id, user_id)

        # THEN the metrics service should have been called with the expected events
        mock_metrics_service.bulk_record_events.assert_called_once()
        events = mock_metrics_service.bulk_record_events.call_args[0][0]
        # AND there should be 1 experience exploration event
        assert len(events) == 1
        assert isinstance(events[0], ExperienceExploredEvent)
        assert events[0].experience_count == 1

    @pytest.mark.asyncio
    async def test_record_metric_events_experience_explored_with_no_change(
            self,
            mock_metrics_service: IMetricsService,
            mock_application_state_manager: IApplicationStateManager,
            setup_application_config: ApplicationConfig
    ):
        # GIVEN a metrics service that successfully records events
        mock_metrics_service.bulk_record_events = AsyncMock()
        # AND a session_id
        session_id = get_random_session_id()
        # AND a user_id
        user_id = get_random_user_id()

        # AND a previous state with an explored experience
        given_previous_state = ApplicationStatesOfInterest(
            conversation_phase="NOT_STARTED",
            counseling_phase="NOT_STARTED",
            compass_message_count=0,
            user_message_count=0,
            experiences_explored_count=5,
            experiences_discovered_count=0,
            work_types_discovered=[]
        )
        # AND a current state with the same explored experience
        given_current_state = ApplicationStatesOfInterest(
            conversation_phase="NOT_STARTED",
            counseling_phase="NOT_STARTED",
            compass_message_count=0,
            user_message_count=0,
            experiences_explored_count=5,  # no change
            experiences_discovered_count=0,
            work_types_discovered=[]
        )
        # WHEN the record_metric_events function is called with a previous state, current state, session_id and user_id
        recorder = ApplicationStateMetricsRecorder(
            application_state_manager=mock_application_state_manager,
            metrics_service=mock_metrics_service
        )
        await recorder.record_metric_events(given_previous_state, given_current_state, session_id, user_id)

        # THEN the metrics service should not have been called
        mock_metrics_service.bulk_record_events.assert_not_called()

    @pytest.mark.asyncio
    async def test_record_metric_events_experiences_discovered_from_empty_state(
            self,
            mock_metrics_service: IMetricsService,
            mock_application_state_manager: IApplicationStateManager,
            setup_application_config: ApplicationConfig
    ):
        # GIVEN a metrics service that successfully records events
        mock_metrics_service.bulk_record_events = AsyncMock()
        # AND a session_id
        session_id = get_random_session_id()
        # AND a user_id
        user_id = get_random_user_id()

        # AND an empty previous state
        given_previous_state = ApplicationStatesOfInterest(
            conversation_phase="NOT_STARTED",
            counseling_phase="NOT_STARTED",
            compass_message_count=0,
            user_message_count=0,
            experiences_explored_count=0,
            experiences_discovered_count=0,
            work_types_discovered=[]
        )
        # AND a current state with an explored experience
        given_current_state = ApplicationStatesOfInterest(
            conversation_phase="NOT_STARTED",
            counseling_phase="DIVE_IN",  # we only count the discovered experiences when we are in the DIVE_IN phase
            compass_message_count=0,
            user_message_count=0,
            experiences_explored_count=0,
            experiences_discovered_count=1,
            work_types_discovered=["WORK_TYPE_1", "WORK_TYPE_2"]
        )

        # WHEN the record_metric_events function is called with a previous state, current state, session_id and user_id
        recorder = ApplicationStateMetricsRecorder(
            application_state_manager=mock_application_state_manager,
            metrics_service=mock_metrics_service
        )
        await recorder.record_metric_events(given_previous_state, given_current_state, session_id, user_id)

        # THEN the metrics service should have been called with the expected events
        mock_metrics_service.bulk_record_events.assert_called_once()
        events = mock_metrics_service.bulk_record_events.call_args[0][0]
        # AND there should be 2 events ( one for moving to dive in and one for the experience discovered)
        assert len(events) == 2
        assert isinstance(events[0], ExperienceDiscoveredEvent)
        assert events[0].experience_count == given_current_state.experiences_discovered_count
        assert events[0].work_types_discovered == given_current_state.work_types_discovered

    @pytest.mark.asyncio
    async def test_record_experience_discovered_event_with_no_change(self, mock_metrics_service: IMetricsService,
                                                                     mock_application_state_manager: IApplicationStateManager,
                                                                     setup_application_config: ApplicationConfig
                                                                     ):
        # GIVEN a metrics service that successfully records events
        mock_metrics_service.bulk_record_events = AsyncMock()
        # AND a session_id
        session_id = get_random_session_id()
        # AND a user_id
        user_id = get_random_user_id()

        # AND a previous state with an experience discovered
        given_previous_state = ApplicationStatesOfInterest(
            conversation_phase="NOT_STARTED",
            counseling_phase="NOT_STARTED",
            compass_message_count=0,
            user_message_count=0,
            experiences_explored_count=0,
            experiences_discovered_count=3,
            work_types_discovered=[]
        )
        # AND a current state with the same experience discovered
        given_current_state = ApplicationStatesOfInterest(
            conversation_phase="NOT_STARTED",
            counseling_phase="NOT_STARTED",
            compass_message_count=0,
            user_message_count=0,
            experiences_explored_count=0,
            experiences_discovered_count=3,  # no change
            work_types_discovered=[]
        )
        # WHEN the record_metric_events function is called with a previous state, current state, session_id and user_id
        recorder = ApplicationStateMetricsRecorder(
            application_state_manager=mock_application_state_manager,
            metrics_service=mock_metrics_service
        )
        await recorder.record_metric_events(given_previous_state, given_current_state, session_id, user_id)

        # THEN the metrics service should not have been called
        mock_metrics_service.bulk_record_events.assert_not_called()

    @pytest.mark.asyncio
    async def test_record_experience_discovered_event_with_only_work_types_changed(
            self,
            mock_metrics_service: IMetricsService,
            mock_application_state_manager: IApplicationStateManager,
            setup_application_config: ApplicationConfig
    ):
        # GIVEN a metrics service that successfully records events
        mock_metrics_service.bulk_record_events = AsyncMock()
        # AND a session_id
        session_id = get_random_session_id()
        # AND a user_id
        user_id = get_random_user_id()

        # AND a previous state with an experience discovered
        given_previous_state = ApplicationStatesOfInterest(
            conversation_phase="NOT_STARTED",
            counseling_phase="NOT_STARTED",
            compass_message_count=0,
            user_message_count=0,
            experiences_explored_count=0,
            experiences_discovered_count=3,
            work_types_discovered=["1"]
        )
        # AND a current state with the same experience discovered
        given_current_state = ApplicationStatesOfInterest(
            conversation_phase="NOT_STARTED",
            counseling_phase="NOT_STARTED",
            compass_message_count=0,
            user_message_count=0,
            experiences_explored_count=0,
            experiences_discovered_count=3,  # no change
            work_types_discovered=["1", "2"]
        )

        # WHEN the record_metric_events function is called with a previous state, current state, session_id and user_id
        recorder = ApplicationStateMetricsRecorder(
            application_state_manager=mock_application_state_manager,
            metrics_service=mock_metrics_service
        )

        await recorder.record_metric_events(given_previous_state, given_current_state, session_id, user_id)

        # THEN the metrics service should be called once
        mock_metrics_service.bulk_record_events.assert_called_once()
