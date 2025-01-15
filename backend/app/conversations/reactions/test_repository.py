"""
Tests for the reaction repository.
It uses the userdata_mocked database, and tests if repository methods work as expected with actual data.
"""
from typing import Awaitable
from datetime import datetime, timezone

import pytest
import pytest_mock
import bson

from app.conversations.reactions.repository import ReactionRepository
from app.conversations.reactions.types import Reaction, ReactionKind, DislikeReason
from common_libs.time_utilities import mongo_date_to_datetime, datetime_to_mongo_date, truncate_microseconds


def _assert_reaction_matches(actual_reaction_doc: dict, given_reaction: Reaction):
    """
    Asserts that a MongoDB document matches the given reaction.
    """
    assert actual_reaction_doc["message_id"] == given_reaction.message_id
    assert actual_reaction_doc["session_id"] == given_reaction.session_id
    assert actual_reaction_doc["kind"] == given_reaction.kind.value
    assert actual_reaction_doc["reasons"] == [r.value for r in given_reaction.reasons]
    assert truncate_microseconds(mongo_date_to_datetime(actual_reaction_doc["created_at"])) == truncate_microseconds(
        given_reaction.created_at)


@pytest.fixture(scope="function")
async def get_reaction_repository(in_memory_application_database) -> ReactionRepository:
    application_db = await in_memory_application_database
    repository = ReactionRepository(application_db)
    return repository


def _get_new_reaction(kind: ReactionKind = ReactionKind.LIKED, reasons: list[DislikeReason] | None = None) -> Reaction:
    """
    Creates a new reaction with the given kind and reasons.
    """
    # Create a reaction with a UTC datetime that will be consistent with MongoDB's date handling
    now = datetime.now(timezone.utc)
    mongo_date = datetime_to_mongo_date(now)
    created_at = mongo_date_to_datetime(mongo_date)

    return Reaction(
        message_id="message123",
        session_id=123,
        kind=kind,
        reasons=reasons or [],
        created_at=created_at
    )


class TestDocumentMapping:
    @pytest.mark.asyncio
    async def test_document_mapping_roundtrip(self):
        # GIVEN a liked reaction
        given_reaction = _get_new_reaction()

        # WHEN it is converted to a document
        actual_doc = ReactionRepository._to_db_doc(given_reaction)

        # AND that document is converted back into a reaction
        actual_reaction = ReactionRepository._from_db_doc(actual_doc)

        # THEN the result should be identical
        assert given_reaction == actual_reaction


class TestAdd:
    @pytest.mark.asyncio
    async def test_add_liked_reaction_success(self, get_reaction_repository: Awaitable[ReactionRepository]):
        repository = await get_reaction_repository

        # GIVEN a liked reaction
        given_reaction = _get_new_reaction()

        # WHEN the add method is called
        result = await repository.add(given_reaction)

        # THEN the result should be a Reaction
        assert isinstance(result, Reaction)
        # AND the id should be a string
        assert isinstance(result.id, str)
        # AND the id should be a valid ObjectId
        assert bson.ObjectId.is_valid(result.id)

        # AND the reaction can be found in the database with the inserted_id
        doc = await repository._collection.find_one({'_id': bson.ObjectId(result.id)})

        # AND the saved reaction matches the given data
        _assert_reaction_matches(doc, given_reaction)

    @pytest.mark.asyncio
    async def test_add_disliked_reaction_success(self, get_reaction_repository: Awaitable[ReactionRepository]):
        repository = await get_reaction_repository

        # GIVEN a disliked reaction with reasons
        given_reaction = _get_new_reaction(
            kind=ReactionKind.DISLIKED,
            reasons=[DislikeReason.INCORRECT_INFORMATION, DislikeReason.BIASED]
        )

        # WHEN the add method is called
        result = await repository.add(given_reaction)

        # THEN the result should be a Reaction
        assert isinstance(result, Reaction)
        # AND the id should be a string
        assert isinstance(result.id, str)
        # AND the id should be a valid ObjectId
        assert bson.ObjectId.is_valid(result.id)

        # AND the reaction can be found in the database with the inserted_id
        doc = await repository._collection.find_one({'_id': bson.ObjectId(result.id)})

        # AND the saved reaction matches the given data
        _assert_reaction_matches(doc, given_reaction)

    @pytest.mark.asyncio
    async def test_db_find_one_and_update_throws(self, get_reaction_repository: Awaitable[ReactionRepository],
                                                 mocker: pytest_mock.MockerFixture):
        repository = await get_reaction_repository

        # GIVEN the repository's collection's insert_one function throws a given exception
        class _GivenError(Exception):
            pass

        given_error = _GivenError("given error message")
        _find_one_and_update_spy = mocker.spy(repository._collection, 'find_one_and_update')
        _find_one_and_update_spy.side_effect = given_error

        # WHEN the add method is called
        with pytest.raises(_GivenError) as actual_error_info:
            await repository.add(_get_new_reaction())

        # AND the raised error message should be the same as the given error
        assert actual_error_info.value == given_error


class TestDelete:
    @pytest.mark.asyncio
    async def test_delete_success(self, get_reaction_repository: Awaitable[ReactionRepository]):
        repository = await get_reaction_repository

        # GIVEN a reaction exists in the database
        given_reaction = _get_new_reaction()
        result = await repository.add(given_reaction)
        assert result.id is not None

        # WHEN the delete method is called
        await repository.delete(given_reaction.session_id, given_reaction.message_id)

        # THEN the reaction should be deleted from the database
        assert await repository._collection.find_one({
            'session_id': given_reaction.session_id,
            'message_id': given_reaction.message_id
        }) is None

    @pytest.mark.asyncio
    async def test_delete_non_existent(self, get_reaction_repository: Awaitable[ReactionRepository]):
        repository = await get_reaction_repository

        # GIVEN a session id and message id that don't exist
        given_session_id = 999
        given_message_id = "nonexistent"

        # WHEN the delete method is called
        # THEN no error should be raised
        await repository.delete(given_session_id, given_message_id)

    @pytest.mark.asyncio
    async def test_db_delete_one_throws(self, get_reaction_repository: Awaitable[ReactionRepository],
                                        mocker: pytest_mock.MockerFixture):
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


class TestGetReactions:
    @pytest.mark.asyncio
    async def test_get_reactions_empty_session(self, get_reaction_repository: Awaitable[ReactionRepository]):
        repository = await get_reaction_repository

        # GIVEN a session id with no reactions
        given_session_id = 999

        # WHEN get_reactions is called
        result = await repository.get_reactions(given_session_id)

        # THEN an empty list should be returned
        assert isinstance(result, list)
        assert len(result) == 0

    @pytest.mark.asyncio
    async def test_get_reactions_with_data(self, get_reaction_repository: Awaitable[ReactionRepository]):
        repository = await get_reaction_repository

        # GIVEN multiple reactions exist for a session
        given_session_id = 123
        given_reactions = [
            _get_new_reaction(),
            _get_new_reaction(
                kind=ReactionKind.DISLIKED,
                reasons=[DislikeReason.INCORRECT_INFORMATION]
            )
        ]
        given_reactions[1].message_id = "message456"  # Set different message_id for second reaction

        # AND the reactions are added to the database
        for reaction in given_reactions:
            await repository.add(reaction)

        # WHEN get_reactions is called
        result = await repository.get_reactions(given_session_id)

        # THEN we should get back the same number of reactions
        assert len(result) == len(given_reactions)

        # AND each reaction should match the corresponding given reaction
        for i, reaction in enumerate(result):
            doc = await repository._collection.find_one({
                'session_id': reaction.session_id,
                'message_id': reaction.message_id
            })
            _assert_reaction_matches(doc, given_reactions[i])

    @pytest.mark.asyncio
    async def test_get_reactions_db_find_throws(self, get_reaction_repository: Awaitable[ReactionRepository],
                                                mocker: pytest_mock.MockerFixture):
        repository = await get_reaction_repository

        # GIVEN the repository's collection's find function throws a given exception
        class _GivenError(Exception):
            pass

        given_error = _GivenError("given error message")
        _find_spy = mocker.spy(repository._collection, 'find')
        _find_spy.side_effect = given_error

        # WHEN get_reactions is called
        with pytest.raises(_GivenError) as actual_error_info:
            await repository.get_reactions(123)

        # THEN the raised error message should be the same as the given error
        assert actual_error_info.value == given_error
