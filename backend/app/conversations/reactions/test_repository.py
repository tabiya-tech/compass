"""
Tests for the reaction repository.
It uses the userdata_mocked database, and tests if repository methods work as expected with actual data.
"""
from datetime import datetime
from typing import Dict, Any

import pytest
import pytest_mock
import bson

from app.conversations.reactions.repository import ReactionRepository
from app.conversations.reactions.types import Reaction, ReactionKind, DislikeReason


def normalize_reaction(reaction: Reaction) -> Reaction:
    """
    Normalizes the reaction object by removing the id field.
    """
    return Reaction(**reaction.model_dump(exclude={'id'}))


@pytest.fixture(scope="function")
async def get_reaction_repository(in_memory_application_database) -> ReactionRepository:
    application_db = await in_memory_application_database
    repository = ReactionRepository(application_db)
    return repository


def _get_new_reaction(kind: ReactionKind = ReactionKind.LIKED, reason: list[DislikeReason] | None = None) -> Reaction:
    """
    Returns a new reaction object with random data for testing purposes.
    """
    return Reaction(
        session_id=123,
        message_id="message123",
        kind=kind,
        reason=reason
    )


class TestAdd:
    @pytest.mark.asyncio
    async def test_add_liked_reaction_success(self, get_reaction_repository: ReactionRepository):
        repository = await get_reaction_repository

        # GIVEN a liked reaction
        given_reaction = _get_new_reaction()

        # WHEN the add method is called
        result = await repository.add(given_reaction)

        # THEN the id is returned as a string
        assert isinstance(result, str)

        # AND the reaction can be found in the database with the inserted_id
        actual_reaction = Reaction.from_dict(
            await repository._collection.find_one({'_id': bson.ObjectId(result)})
        )

        # AND the saved reaction is equal to the given data
        assert normalize_reaction(actual_reaction) == normalize_reaction(given_reaction)

    @pytest.mark.asyncio
    async def test_add_disliked_reaction_success(self, get_reaction_repository: ReactionRepository):
        repository = await get_reaction_repository

        # GIVEN a disliked reaction with reasons
        given_reaction = _get_new_reaction(
            kind=ReactionKind.DISLIKED,
            reason=[DislikeReason.INCORRECT_INFORMATION, DislikeReason.BIASED]
        )

        # WHEN the add method is called
        result = await repository.add(given_reaction)

        # THEN the id is returned as a string
        assert isinstance(result, str)

        # AND the reaction can be found in the database with the inserted_id
        actual_reaction = Reaction.from_dict(
            await repository._collection.find_one({'_id': bson.ObjectId(result)})
        )

        # AND the saved reaction is equal to the given data
        assert normalize_reaction(actual_reaction) == normalize_reaction(given_reaction)

class TestDelete:
    @pytest.mark.asyncio
    async def test_delete_success(self, get_reaction_repository: ReactionRepository):
        repository = await get_reaction_repository

        # GIVEN a reaction exists in the database
        given_reaction = _get_new_reaction()
        inserted_id = await repository.add(given_reaction)
        assert inserted_id is not None

        # WHEN the delete method is called
        await repository.delete(given_reaction.session_id, given_reaction.message_id)

        # THEN the reaction should be deleted from the database
        assert await repository._collection.find_one({
            'session_id': given_reaction.session_id,
            'message_id': given_reaction.message_id
        }) is None

    @pytest.mark.asyncio
    async def test_delete_non_existent(self, get_reaction_repository: ReactionRepository):
        repository = await get_reaction_repository

        # GIVEN a session id and message id that don't exist
        given_session_id = 999
        given_message_id = "nonexistent"

        # WHEN the delete method is called
        # THEN no error should be raised
        await repository.delete(given_session_id, given_message_id)

    @pytest.mark.asyncio
    async def test_db_delete_one_throws(self, get_reaction_repository: ReactionRepository, mocker: pytest_mock.MockerFixture):
        repository = await get_reaction_repository

        # GIVEN the repository's collection's delete_one function throws a given exception
        class _GivenError(Exception):
            pass

        given_error = _GivenError("given error message")
        _delete_one_spy = mocker.spy(repository._collection, 'delete_one')
        _delete_one_spy.side_effect = given_error

        # WHEN the delete method is called
        # THEN an exception is raised
        with pytest.raises(_GivenError) as actual_error_info:
            await repository.delete(123, "message123")

        # AND the raised error message should be the same as the given error
        assert actual_error_info.value == given_error
