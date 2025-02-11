"""
Tests for the reaction service
"""
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest
import pytest_mock

from app.agent.agent_types import AgentInput, AgentOutput
from app.application_state import IApplicationStateManager, ApplicationState
from app.conversation_memory.conversation_memory_manager import IConversationMemoryManager
from app.conversation_memory.conversation_memory_types import ConversationMemoryManagerState, ConversationContext, \
    ConversationHistory, ConversationTurn
from app.conversations.reactions.repository import IReactionRepository
from app.conversations.reactions.service import ReactionService, ReactingToUserMessageError
from app.conversations.reactions.types import ReactionRequest, ReactionKind, DislikeReason, Reaction
from common_libs.test_utilities.mock_application_state import get_mock_application_state


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


class TestAdd:
    # Class-level variables shared across all test methods
    _given_session_id = 123
    _given_message_id = "message123"

    @pytest.mark.asyncio
    async def test_add_liked_reaction_success(self, _mock_reaction_repository: IReactionRepository,
                                              _mock_application_state_manager: IApplicationStateManager,
                                              _mock_conversation_memory_manager: IConversationMemoryManager,
                                              mocker: pytest_mock.MockerFixture):
        # GIVEN a liked reaction request
        given_reaction = ReactionRequest(kind=ReactionKind.LIKED)

        # AND the message with the given message_id is a COMPASS message in the conversation context
        _mock_application_state_manager.get_state = AsyncMock(
            return_value=get_mock_application_state(self._given_session_id))
        given_conversation_context = get_mock_conversation_context(self._given_message_id)
        _mock_conversation_memory_manager.get_conversation_context = AsyncMock(return_value=given_conversation_context)
        _mock_conversation_memory_manager.set_state = AsyncMock(return_value=None)
        _mock_conversation_memory_manager.is_user_message = AsyncMock(return_value=False)

        # WHEN the add method is called
        service = ReactionService(reaction_repository=_mock_reaction_repository,
                                  conversation_memory_manager=_mock_conversation_memory_manager,
                                  application_state_manager=_mock_application_state_manager)
        actual_reaction = Reaction(
            id="mock_doc_id",
            session_id=self._given_session_id,
            message_id=self._given_message_id,
            kind=given_reaction.kind,
            created_at=datetime.now(timezone.utc)
        )
        _mock_reaction_repository.add = AsyncMock(return_value=actual_reaction)
        result = await service.add(self._given_session_id, self._given_message_id, given_reaction)

        # THEN the repository.add should be called only once
        _mock_reaction_repository.add.assert_called_once()

        # Get the actual reaction passed to the repository.add
        actual_reaction = _mock_reaction_repository.add.call_args[0][0]
        # AND the repository.add should be called with the correct parameters
        assert actual_reaction.session_id == self._given_session_id
        assert actual_reaction.message_id == self._given_message_id
        assert actual_reaction.kind == given_reaction.kind
        assert actual_reaction.reasons == []

        # AND the returned document should have the correct values
        assert isinstance(result, Reaction)
        assert result.id == "mock_doc_id"
        assert result.session_id == self._given_session_id
        assert result.message_id == self._given_message_id
        assert result.kind == given_reaction.kind
        assert result.reasons == []

    @pytest.mark.asyncio
    async def test_add_disliked_reaction_success(self, _mock_reaction_repository: IReactionRepository,
                                                 _mock_application_state_manager: IApplicationStateManager,
                                                 _mock_conversation_memory_manager: IConversationMemoryManager,
                                                 mocker: pytest_mock.MockerFixture):
        # GIVEN a disliked reaction request with reasons
        given_reaction = ReactionRequest(
            kind=ReactionKind.DISLIKED,
            reasons=[DislikeReason.INCORRECT_INFORMATION]
        )

        # AND the message with the given message_id is a COMPASS message in the conversation context
        _mock_application_state_manager.get_state = AsyncMock(
            return_value=get_mock_application_state(self._given_session_id))
        given_conversation_context = get_mock_conversation_context(self._given_message_id)
        _mock_conversation_memory_manager.get_conversation_context = AsyncMock(return_value=given_conversation_context)
        _mock_conversation_memory_manager.set_state = AsyncMock(return_value=None)
        _mock_conversation_memory_manager.is_user_message = AsyncMock(return_value=False)

        # WHEN the add method is called
        service = ReactionService(reaction_repository=_mock_reaction_repository,
                                  conversation_memory_manager=_mock_conversation_memory_manager,
                                  application_state_manager=_mock_application_state_manager)
        actual_reaction = Reaction(
            id="mock_doc_id",
            session_id=self._given_session_id,
            message_id=self._given_message_id,
            kind=given_reaction.kind,
            reasons=given_reaction.reasons,
            created_at=datetime.now(timezone.utc)
        )
        _mock_reaction_repository.add = AsyncMock(return_value=actual_reaction)
        result = await service.add(self._given_session_id, self._given_message_id, given_reaction)

        # THEN the repository.add should be called only once
        _mock_reaction_repository.add.assert_called_once()

        # Get the actual reaction passed to the repository.add
        actual_reaction = _mock_reaction_repository.add.call_args[0][0]
        # AND the repository.add should be called with the correct parameters
        assert actual_reaction.session_id == self._given_session_id
        assert actual_reaction.message_id == self._given_message_id
        assert actual_reaction.kind == given_reaction.kind
        assert actual_reaction.reasons == given_reaction.reasons

        # AND the returned document should have the correct values
        assert isinstance(result, Reaction)
        assert result.id == "mock_doc_id"
        assert result.session_id == self._given_session_id
        assert result.message_id == self._given_message_id
        assert result.kind == given_reaction.kind
        assert result.reasons == given_reaction.reasons

    @pytest.mark.asyncio
    async def test_add_reaction_to_user_message_raises_error(self, _mock_reaction_repository: IReactionRepository,
                                                             _mock_application_state_manager: IApplicationStateManager,
                                                             _mock_conversation_memory_manager: IConversationMemoryManager,
                                                             mocker: pytest_mock.MockerFixture):
        # GIVEN a liked reaction request
        given_reaction = ReactionRequest(kind=ReactionKind.LIKED)

        # AND the message with the given message_id is a USER message in the conversation context
        _mock_application_state_manager.get_state = AsyncMock(
            return_value=get_mock_application_state(self._given_session_id))
        _mock_conversation_memory_manager.set_state = AsyncMock(return_value=None)
        _mock_conversation_memory_manager.is_user_message = AsyncMock(return_value=True)

        # WHEN the add method is called
        with pytest.raises(ReactingToUserMessageError) as error_info:
            service = ReactionService(reaction_repository=_mock_reaction_repository,
                                      conversation_memory_manager=_mock_conversation_memory_manager,
                                      application_state_manager=_mock_application_state_manager)
            await service.add(self._given_session_id, self._given_message_id, given_reaction)

        # THEN a ReactingToUserMessageError should be raised with the appropriate message
        assert str(
            error_info.value) == f"The message with id {self._given_message_id} is a message from the user. User messages cannot be reacted to."

    @pytest.mark.asyncio
    async def test_add_repository_throws_an_error(self, _mock_reaction_repository: IReactionRepository,
                                                  _mock_application_state_manager: IApplicationStateManager,
                                                  _mock_conversation_memory_manager: IConversationMemoryManager,
                                                  mocker: pytest_mock.MockerFixture):
        # GIVEN the repository.add throws some error
        given_error = Exception("given error message")
        _add_spy = mocker.patch.object(_mock_reaction_repository, 'add')
        _add_spy.side_effect = given_error

        # AND the message with the given message_id is a COMPASS message in the conversation context
        _mock_application_state_manager.get_state = AsyncMock(
            return_value=get_mock_application_state(self._given_session_id))
        given_conversation_context = get_mock_conversation_context(self._given_message_id)
        _mock_conversation_memory_manager.get_conversation_context = AsyncMock(return_value=given_conversation_context)
        _mock_conversation_memory_manager.set_state = AsyncMock(return_value=None)
        _mock_conversation_memory_manager.is_user_message = AsyncMock(return_value=False)

        # WHEN the add method is called
        with pytest.raises(Exception) as error_info:
            service = ReactionService(reaction_repository=_mock_reaction_repository,
                                      conversation_memory_manager=_mock_conversation_memory_manager,
                                      application_state_manager=_mock_application_state_manager)
            given_reaction = ReactionRequest(kind=ReactionKind.LIKED)
            await service.add(self._given_session_id, self._given_message_id, given_reaction)

        # THEN an exception should be raised
        assert str(error_info.value) == str(given_error)

    @pytest.mark.asyncio
    async def test_add_conversation_memory_manager_throws_an_error(self, _mock_reaction_repository: IReactionRepository,
                                                                   _mock_application_state_manager: IApplicationStateManager,
                                                                   _mock_conversation_memory_manager: IConversationMemoryManager,
                                                                   mocker: pytest_mock.MockerFixture):
        # GIVEN the conversation_memory_manager.get_conversation_context throws some error
        _mock_application_state_manager.get_state = AsyncMock(
            return_value=get_mock_application_state(self._given_session_id))
        given_error = Exception("conversation memory manager error")
        _mock_conversation_memory_manager.set_state = AsyncMock(return_value=None)
        _mock_conversation_memory_manager.is_user_message = AsyncMock(side_effect=given_error)

        # WHEN the add method is called
        with pytest.raises(Exception) as error_info:
            service = ReactionService(reaction_repository=_mock_reaction_repository,
                                      conversation_memory_manager=_mock_conversation_memory_manager,
                                      application_state_manager=_mock_application_state_manager)
            given_reaction = ReactionRequest(kind=ReactionKind.LIKED)
            await service.add(self._given_session_id, self._given_message_id, given_reaction)

        # THEN an exception should be raised
        assert str(error_info.value) == str(given_error)

    @pytest.mark.asyncio
    async def test_add_application_state_manager_throws_an_error(self, _mock_reaction_repository: IReactionRepository,
                                                                 _mock_application_state_manager: IApplicationStateManager,
                                                                 _mock_conversation_memory_manager: IConversationMemoryManager,
                                                                 mocker: pytest_mock.MockerFixture):
        # GIVEN the application_state_manager.get_state throws some error
        given_error = Exception("application state manager error")
        _mock_application_state_manager.get_state = AsyncMock(side_effect=given_error)

        # AND the message with the given message_id is a COMPASS message in the conversation context
        given_conversation_context = get_mock_conversation_context(self._given_message_id)
        _mock_conversation_memory_manager.get_conversation_context = AsyncMock(return_value=given_conversation_context)

        # WHEN the add method is called
        with pytest.raises(Exception) as error_info:
            service = ReactionService(reaction_repository=_mock_reaction_repository,
                                      conversation_memory_manager=_mock_conversation_memory_manager,
                                      application_state_manager=_mock_application_state_manager)
            given_reaction = ReactionRequest(kind=ReactionKind.LIKED)
            await service.add(self._given_session_id, self._given_message_id, given_reaction)

        # THEN an exception should be raised
        assert str(error_info.value) == str(given_error)


class TestDelete:
    # Class-level variables shared across all test methods
    _given_session_id = 123
    _given_message_id = "message123"

    @pytest.mark.asyncio
    async def test_delete_success(self, _mock_reaction_repository: IReactionRepository,
                                  _mock_application_state_manager: IApplicationStateManager,
                                  _mock_conversation_memory_manager: IConversationMemoryManager,
                                  mocker: pytest_mock.MockerFixture):
        # WHEN the delete method is called
        service = ReactionService(reaction_repository=_mock_reaction_repository,
                                  conversation_memory_manager=_mock_conversation_memory_manager,
                                  application_state_manager=_mock_application_state_manager)
        _mock_reaction_repository.delete = AsyncMock(return_value=None)
        await service.delete(self._given_session_id, self._given_message_id)

        # THEN the repository.delete should be called with the correct parameters
        _mock_reaction_repository.delete.assert_called_once_with(self._given_session_id, self._given_message_id)
