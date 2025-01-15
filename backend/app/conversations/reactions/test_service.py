"""
Tests for the reaction service
"""
from datetime import datetime
from typing import List, Optional

import pytest
import pytest_mock

from app.conversations.reactions.repository import IReactionRepository
from app.conversations.reactions.service import ReactionService
from app.conversations.reactions.types import ReactionRequest, ReactionKind, DislikeReason, Reaction


@pytest.fixture(scope='function')
def _mock_repository() -> IReactionRepository:
    class MockedReactionRepository(IReactionRepository):
        async def add(self, reaction: Reaction) -> Optional[str]:
            return None

        async def delete(self, session_id: int, message_id: str):
            return None
        
        async def get_reactions(self, session_id: int) -> List[Reaction] | None:
            return None

    return MockedReactionRepository()


class TestAdd:
    @pytest.mark.asyncio
    async def test_add_liked_reaction_success(self, _mock_repository: IReactionRepository, mocker: pytest_mock.MockerFixture):
        # GIVEN a session id and message id
        given_session_id = 123
        given_message_id = "message123"

        # AND a liked reaction request
        given_reaction = ReactionRequest(kind=ReactionKind.LIKED)

        # WHEN the add method is called
        service = ReactionService(_mock_repository)
        _add_spy = mocker.spy(_mock_repository, 'add')
        await service.add(given_session_id, given_message_id, given_reaction)

        # THEN the repository.add should be called only once
        _add_spy.assert_called_once()

        # Get the actual reaction passed to the repository.add
        actual_reaction = _add_spy.call_args[0][0]
        # AND the repository.add should be called with the correct parameters
        assert actual_reaction.session_id == given_session_id
        assert actual_reaction.message_id == given_message_id
        assert actual_reaction.kind == given_reaction.kind
        assert actual_reaction.reason is None

    @pytest.mark.asyncio
    async def test_add_disliked_reaction_success(self, _mock_repository: IReactionRepository, mocker: pytest_mock.MockerFixture):
        # GIVEN a session id and message id
        given_session_id = 123
        given_message_id = "message123"

        # AND a disliked reaction request with reasons
        given_reaction = ReactionRequest(
            kind=ReactionKind.DISLIKED,
            reason=[DislikeReason.INCORRECT]
        )

        # WHEN the add method is called
        service = ReactionService(_mock_repository)
        _add_spy = mocker.spy(_mock_repository, 'add')
        await service.add(given_session_id, given_message_id, given_reaction)

        # THEN the repository.add should be called only once
        _add_spy.assert_called_once()

        # Get the actual reaction passed to the repository.add
        actual_reaction = _add_spy.call_args[0][0]
        # AND the repository.add should be called with the correct parameters
        assert actual_reaction.session_id == given_session_id
        assert actual_reaction.message_id == given_message_id
        assert actual_reaction.kind == given_reaction.kind
        assert actual_reaction.reason == given_reaction.reason
    
    @pytest.mark.asyncio
    async def test_add_repository_throws_an_error(self, _mock_repository: IReactionRepository, mocker: pytest_mock.MockerFixture):
        # GIVEN the repository.add throws some error
        given_error = Exception("given error message")
        _add_spy = mocker.patch.object(_mock_repository, 'add')
        _add_spy.side_effect = given_error

        # WHEN the add method is called
        with pytest.raises(Exception) as error_info:
            service = ReactionService(_mock_repository)
            given_session_id = 123
            given_message_id = "message123"
            given_reaction = ReactionRequest(kind=ReactionKind.LIKED)
            await service.add(given_session_id, given_message_id, given_reaction)

        # THEN an exception should be raised
        assert str(error_info.value) == str(given_error)

class TestDelete:
    @pytest.mark.asyncio
    async def test_delete_success(self, _mock_repository: IReactionRepository, mocker: pytest_mock.MockerFixture):
        # GIVEN a session id and message id
        given_session_id = 123
        given_message_id = "message123"

        # WHEN the delete method is called
        service = ReactionService(_mock_repository)
        _delete_spy = mocker.spy(_mock_repository, 'delete')
        await service.delete(given_session_id, given_message_id)

        # THEN the repository.delete should be called with the correct parameters
        _delete_spy.assert_called_once_with(given_session_id, given_message_id)
