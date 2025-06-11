"""
Tests for the reaction service
"""
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from app.agent.agent_types import AgentInput, AgentOutput
from app.app_config import ApplicationConfig
from app.application_state import IApplicationStateManager, ApplicationState
from app.conversation_memory.conversation_memory_manager import IConversationMemoryManager
from app.conversation_memory.conversation_memory_types import ConversationMemoryManagerState, ConversationContext, \
    ConversationHistory, ConversationTurn
from app.conversations.reactions.repository import IReactionRepository
from app.conversations.reactions.service import ReactionService, ReactingToUserMessageError
from app.conversations.reactions.types import ReactionKind, DislikeReason, Reaction
from app.metrics.common import hash_metric_value
from app.metrics.services.service import IMetricsService
from app.metrics.types import MessageReactionCreatedEvent
from common_libs.test_utilities import get_random_user_id


def get_mock_conversation_context(message_id: str) -> ConversationContext:
    return ConversationContext(
        all_history=ConversationHistory(
            turns=[
                ConversationTurn(
                    index=0,
                    input=AgentInput(
                        message_id="foo_input_id",
                        message=""
                    ),
                    output=AgentOutput(
                        message_id=message_id,
                        message_for_user="Hi, I'm compass.",
                        finished=False,
                        agent_response_time_in_sec=0.1,
                        llm_stats=[]
                    )
                )
            ]
        )
    )


def _get_new_reaction(*,
                      session_id: int | None = None,
                      message_id: str | None = None,
                      kind: ReactionKind | None = None,
                      reasons: list[DislikeReason] | None = None
                      ) -> Reaction:
    """
    Returns a new reaction object with random data for testing purposes.
    If any parameters are provided, they will be used instead of random values.
    
    Args:
        session_id: Optional specific session ID to use
        message_id: Optional specific message ID to use
        kind: Optional specific reaction kind to use
        reasons: Optional specific reasons to use (only valid for DISLIKED reactions)
    """
    import random
    import uuid

    # Generate random session ID if not provided
    _session_id = session_id if session_id is not None else random.randint(1, 10000)  # nosec B311 # random is used for testing purposes
    # Generate random message ID if not provided 
    _message_id = message_id if message_id is not None else str(uuid.uuid4())

    # Use provided kind or randomly choose one
    _kind = kind if kind is not None else random.choice(list(ReactionKind))  # nosec B311 # random is used for testing purposes

    # Handle reasons based on kind
    _reasons = []
    if _kind == ReactionKind.DISLIKED:
        if reasons is not None:
            _reasons = reasons
        else:
            # Choose 1-3 random reasons
            num_reasons = random.randint(1, min(3, len(list(DislikeReason))))  # nosec B311 # random is used for testing purposes
            _reasons = random.sample(list(DislikeReason), num_reasons)  # nosec B311 # random is used for testing purposes

    # Generate a random creation timestamp within the last day
    _created_at = datetime.now(timezone.utc) - timedelta(
        hours=random.randint(0, 23),  # nosec B311 # random is used for testing purposes
        minutes=random.randint(0, 59),  # nosec B311 # random is used for testing purposes
        seconds=random.randint(0, 59)  # nosec B311 # random is used for testing purposes
    )

    return Reaction(
        message_id=_message_id,
        session_id=_session_id,
        kind=_kind,
        reasons=_reasons,
        created_at=_created_at
    )


@pytest.fixture(scope='function')
def _mock_reaction_repository() -> IReactionRepository:
    class MockedReactionRepository(IReactionRepository):
        async def add(self, reaction: Reaction) -> Reaction:
            raise NotImplementedError()

        async def delete(self, session_id: int, message_id: str):
            raise NotImplementedError()

        async def get_reactions(self, session_id: int) -> list[Reaction] | None:
            raise NotImplementedError()

    return MockedReactionRepository()


@pytest.fixture(scope='function')
def _mock_application_state_manager() -> IApplicationStateManager:
    class MockedApplicationStateManager(IApplicationStateManager):
        async def get_state(self, session_id: int):
            raise NotImplementedError()

        async def save_state(self, state: ApplicationState):
            raise NotImplementedError()

        async def delete_state(self, session_id: int) -> None:
            raise NotImplementedError()

        async def get_all_session_ids(self):
            raise NotImplementedError()

    return MockedApplicationStateManager()


@pytest.fixture(scope="function")
def _mock_conversation_memory_manager() -> IConversationMemoryManager:
    class MockedConversationMemoryManager(IConversationMemoryManager):
        def set_state(self, state: ConversationMemoryManagerState):
            raise NotImplementedError()

        async def get_conversation_context(self):
            raise NotImplementedError()

        async def update_history(self, user_input: AgentInput, agent_output: AgentOutput):
            raise NotImplementedError()

        async def is_user_message(self, message_id: str):
            raise NotImplementedError()

    return MockedConversationMemoryManager()


@pytest.fixture(scope='function')
def _mock_metrics_service() -> IMetricsService:
    class MockedMetricsService(IMetricsService):
        async def record_event(self, event: MessageReactionCreatedEvent):
            raise NotImplementedError()

    return MockedMetricsService()


class TestAdd:
    # Class-level variables shared across all test methods
    _given_session_id = 123
    _given_message_id = "message123"

    @pytest.mark.asyncio
    async def test_add_liked_reaction_success(self, _mock_reaction_repository: IReactionRepository,
                                              _mock_application_state_manager: IApplicationStateManager,
                                              _mock_conversation_memory_manager: IConversationMemoryManager,
                                              _mock_metrics_service: IMetricsService,
                                              setup_application_config: ApplicationConfig):
        # GIVEN a liked reaction
        given_reaction = _get_new_reaction(
            session_id=self._given_session_id,
            message_id=self._given_message_id,
            kind=ReactionKind.LIKED
        )
        # AND a user id
        given_user_id = get_random_user_id()

        # AND a given client id
        given_client_id = uuid4().__str__()

        # AND the message with the given message_id is a COMPASS message in the conversation context
        _mock_application_state_manager.get_state = AsyncMock(
            return_value=ApplicationState.new_state(self._given_session_id))
        given_conversation_context = get_mock_conversation_context(self._given_message_id)
        _mock_conversation_memory_manager.get_conversation_context = AsyncMock(return_value=given_conversation_context)
        _mock_conversation_memory_manager.set_state = Mock(return_value=None)
        _mock_conversation_memory_manager.is_user_message = AsyncMock(return_value=False)

        # AND the repository will add a reaction successfully and return a different reaction
        # This ensures we're returning what the repository returns, not just the input
        mock_returned_reaction = _get_new_reaction()  # Completely different random reaction
        _mock_reaction_repository.add = AsyncMock(return_value=mock_returned_reaction)

        # AND the metrics service will record the event successfully
        _mock_metrics_service.record_event = AsyncMock()

        # WHEN the add method is called
        service = ReactionService(reaction_repository=_mock_reaction_repository,
                                  conversation_memory_manager=_mock_conversation_memory_manager,
                                  application_state_manager=_mock_application_state_manager,
                                  metrics_service=_mock_metrics_service)

        # THEN the reaction should be added successfully and return the repository's reaction
        result = await service.add(given_reaction, given_user_id, given_client_id)
        assert result == mock_returned_reaction  # Assert we get the repository's reaction back
        assert result != given_reaction  # Double check we're not just getting our input back

        # AND the metrics service should have been called with the correct event
        _mock_metrics_service.record_event.assert_called_once()
        recorded_event = _mock_metrics_service.record_event.call_args[0][0]
        assert isinstance(recorded_event, MessageReactionCreatedEvent)
        assert recorded_event.message_id == given_reaction.message_id
        assert recorded_event.kind == given_reaction.kind.name
        assert recorded_event.anonymized_client_id == hash_metric_value(given_client_id)
        assert recorded_event.reasons == [reason.name for reason in given_reaction.reasons]

    @pytest.mark.asyncio
    async def test_add_disliked_reaction_success(self, _mock_reaction_repository: IReactionRepository,
                                                 _mock_application_state_manager: IApplicationStateManager,
                                                 _mock_conversation_memory_manager: IConversationMemoryManager,
                                                 _mock_metrics_service: IMetricsService,
                                                 setup_application_config: ApplicationConfig):
        # GIVEN a disliked reaction with reasons
        given_reaction = _get_new_reaction(
            session_id=self._given_session_id,
            message_id=self._given_message_id,
            kind=ReactionKind.DISLIKED,
            reasons=[DislikeReason.INCORRECT_INFORMATION]
        )
        # AND a user id
        given_user_id = get_random_user_id()

        # AND a given client id
        given_client_id = None

        # AND the message with the given message_id is a COMPASS message in the conversation context
        _mock_application_state_manager.get_state = AsyncMock(
            return_value=ApplicationState.new_state(self._given_session_id))
        given_conversation_context = get_mock_conversation_context(self._given_message_id)
        _mock_conversation_memory_manager.get_conversation_context = AsyncMock(return_value=given_conversation_context)
        _mock_conversation_memory_manager.set_state = Mock(return_value=None)
        _mock_conversation_memory_manager.is_user_message = AsyncMock(return_value=False)

        # AND the repository will add a reaction successfully and return a different reaction
        mock_returned_reaction = _get_new_reaction(
            kind=ReactionKind.DISLIKED,
            reasons=[DislikeReason.INCORRECT_INFORMATION]
        )
        _mock_reaction_repository.add = AsyncMock(return_value=mock_returned_reaction)

        # AND the metrics service will record the event successfully
        _mock_metrics_service.record_event = AsyncMock()

        # WHEN the add method is called
        service = ReactionService(reaction_repository=_mock_reaction_repository,
                                  conversation_memory_manager=_mock_conversation_memory_manager,
                                  application_state_manager=_mock_application_state_manager,
                                  metrics_service=_mock_metrics_service)

        # THEN the reaction should be added successfully and return the repository's reaction
        result = await service.add(given_reaction, given_user_id, given_client_id)
        assert result == mock_returned_reaction  # Assert we get the repository's reaction back
        assert result != given_reaction  # Double check we're not just getting our input back

        # AND the metrics service should have been called with the correct event
        _mock_metrics_service.record_event.assert_called_once()
        recorded_event = _mock_metrics_service.record_event.call_args[0][0]
        assert isinstance(recorded_event, MessageReactionCreatedEvent)
        assert recorded_event.message_id == given_reaction.message_id
        assert recorded_event.kind == given_reaction.kind.name
        assert recorded_event.anonymized_client_id == None
        assert recorded_event.reasons == [reason.name for reason in given_reaction.reasons]

    @pytest.mark.asyncio
    async def test_add_reaction_to_user_message_raises_error(self, _mock_reaction_repository: IReactionRepository,
                                                             _mock_application_state_manager: IApplicationStateManager,
                                                             _mock_conversation_memory_manager: IConversationMemoryManager,
                                                             _mock_metrics_service: IMetricsService):
        # GIVEN a liked reaction
        given_reaction = _get_new_reaction(
            session_id=self._given_session_id,
            message_id=self._given_message_id,
            kind=ReactionKind.LIKED
        )
        # AND a user id
        given_user_id = get_random_user_id()

        # AND a given client id
        given_client_id = None

        # AND the message with the given message_id is a USER message in the conversation context
        _mock_application_state_manager.get_state = AsyncMock(
            return_value=ApplicationState.new_state(self._given_session_id))
        _mock_conversation_memory_manager.set_state = Mock(return_value=None)
        _mock_conversation_memory_manager.is_user_message = AsyncMock(return_value=True)

        # AND the metrics service will record the event successfully
        _mock_metrics_service.record_event = AsyncMock()

        # WHEN the add method is called
        with pytest.raises(ReactingToUserMessageError):
            service = ReactionService(reaction_repository=_mock_reaction_repository,
                                      conversation_memory_manager=_mock_conversation_memory_manager,
                                      application_state_manager=_mock_application_state_manager,
                                      metrics_service=_mock_metrics_service)
            await service.add(given_reaction, given_user_id, given_client_id)

        # THEN the metrics service should not have been called
        _mock_metrics_service.record_event.assert_not_called()

    @pytest.mark.asyncio
    async def test_add_repository_throws_an_error(self, _mock_reaction_repository: IReactionRepository,
                                                  _mock_application_state_manager: IApplicationStateManager,
                                                  _mock_conversation_memory_manager: IConversationMemoryManager,
                                                  _mock_metrics_service: IMetricsService):
        # GIVEN the repository.add throws some error
        given_error = Exception("Some error")
        _mock_reaction_repository.add = AsyncMock(side_effect=given_error)

        # AND a liked reaction
        given_reaction = _get_new_reaction(
            session_id=self._given_session_id,
            message_id=self._given_message_id,
            kind=ReactionKind.LIKED
        )
        # AND a user id
        given_user_id = get_random_user_id()

        # AND a given client id
        given_client_id = uuid4().__str__()

        # AND the message with the given message_id is a COMPASS message in the conversation context
        _mock_application_state_manager.get_state = AsyncMock(
            return_value=ApplicationState.new_state(self._given_session_id))
        _mock_conversation_memory_manager.set_state = Mock(return_value=None)
        _mock_conversation_memory_manager.is_user_message = AsyncMock(return_value=False)

        # AND the metrics service will record the event successfully
        _mock_metrics_service.record_event = AsyncMock()

        # WHEN the add method is called
        with pytest.raises(Exception) as error_info:
            service = ReactionService(reaction_repository=_mock_reaction_repository,
                                      conversation_memory_manager=_mock_conversation_memory_manager,
                                      application_state_manager=_mock_application_state_manager,
                                      metrics_service=_mock_metrics_service)
            await service.add(given_reaction, given_user_id, given_client_id)

        # THEN the error should be raised
        assert error_info.value == given_error

        # AND the metrics service should not have been called since the repository failed
        _mock_metrics_service.record_event.assert_not_called()

    @pytest.mark.asyncio
    async def test_add_application_state_manager_throws_an_error(self, _mock_reaction_repository: IReactionRepository,
                                                                 _mock_application_state_manager: IApplicationStateManager,
                                                                 _mock_conversation_memory_manager: IConversationMemoryManager,
                                                                 _mock_metrics_service: IMetricsService):
        # GIVEN the application_state_manager.get_state throws some error
        given_error = Exception("Some error")
        _mock_application_state_manager.get_state = AsyncMock(side_effect=given_error)

        # AND a liked reaction
        given_reaction = _get_new_reaction(
            session_id=self._given_session_id,
            message_id=self._given_message_id,
            kind=ReactionKind.LIKED
        )
        # AND a user id
        given_user_id = get_random_user_id()

        # AND a given client id
        given_client_id = None

        # AND the metrics service will record the event successfully
        _mock_metrics_service.record_event = AsyncMock()

        # WHEN the add method is called
        with pytest.raises(Exception) as error_info:
            service = ReactionService(reaction_repository=_mock_reaction_repository,
                                      conversation_memory_manager=_mock_conversation_memory_manager,
                                      application_state_manager=_mock_application_state_manager,
                                      metrics_service=_mock_metrics_service)
            await service.add(given_reaction, given_user_id, given_client_id)

        # THEN the error should be raised
        assert error_info.value == given_error

        # AND the metrics service should not have been called since getting the state failed
        _mock_metrics_service.record_event.assert_not_called()


class TestDelete:
    # Class-level variables shared across all test methods
    _given_session_id = 123
    _given_message_id = "message123"

    @pytest.mark.asyncio
    async def test_delete_success(self, _mock_reaction_repository: IReactionRepository,
                                  _mock_application_state_manager: IApplicationStateManager,
                                  _mock_conversation_memory_manager: IConversationMemoryManager,
                                  _mock_metrics_service: IMetricsService):
        # GIVEN the repository will delete successfully
        _mock_reaction_repository.delete = AsyncMock()

        # WHEN the delete method is called
        service = ReactionService(reaction_repository=_mock_reaction_repository,
                                  conversation_memory_manager=_mock_conversation_memory_manager,
                                  application_state_manager=_mock_application_state_manager,
                                  metrics_service=_mock_metrics_service)
        await service.delete(self._given_session_id, self._given_message_id)

        # THEN the repository should have been called with the correct parameters
        _mock_reaction_repository.delete.assert_called_once_with(self._given_session_id, self._given_message_id)
