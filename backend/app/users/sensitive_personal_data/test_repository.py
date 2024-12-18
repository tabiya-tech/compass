"""
This module contains the tests for the SensitivePersonalDataRepository class.
It uses the userdata_mocked database, and tests if repository methods work as expected with actual data.
"""
from typing import Awaitable

import bson
import pytest
from datetime import datetime

import pytest_mock
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.users.sensitive_personal_data.types import SensitivePersonalData
from app.users.sensitive_personal_data.repository import SensitivePersonalDataRepository
from common_libs.test_utilities.random_data import get_random_printable_string


def _get_new_sensitive_personal_data():
    """
    Returns a new sensitive personal data object with random data for testing purposes.
    """
    return SensitivePersonalData(
        user_id=get_random_printable_string(10),
        aes_encryption_key=get_random_printable_string(10),
        rsa_key_id=get_random_printable_string(20),
        aes_encrypted_data=get_random_printable_string(100),
        created_at=datetime.now()
    )


@pytest.fixture(scope="function")
async def get_sensitive_personal_data_repository(in_memory_userdata_database) -> SensitivePersonalDataRepository:
    userdata_db = await in_memory_userdata_database
    repository = SensitivePersonalDataRepository(userdata_db)
    return repository


class TestFindById:
    @pytest.mark.asyncio
    async def test_success(self, get_sensitive_personal_data_repository: Awaitable[SensitivePersonalDataRepository]):
        repository = await get_sensitive_personal_data_repository

        # GIVEN some sensitive personal data that exists in the database
        given_sensitive_data = _get_new_sensitive_personal_data()
        await repository._collection.insert_one(given_sensitive_data.model_dump())

        # WHEN the find_by_user_id method is called for the given user id
        actual_sensitive_data = await repository.find_by_user_id(given_sensitive_data.user_id)

        # THEN the sensitive personal data is found and is equal to the same sensitive data in the database
        assert actual_sensitive_data == given_sensitive_data

    @pytest.mark.asyncio
    async def test_not_found(self, get_sensitive_personal_data_repository: Awaitable[SensitivePersonalDataRepository]):
        repository = await get_sensitive_personal_data_repository

        # GIVEN some user id that does not exist in the database
        given_user_id = get_random_printable_string(10)

        # WHEN the find_by_user_id method is called for the given user id
        actual_sensitive_data = await repository.find_by_user_id(given_user_id)

        # THEN the sensitive personal data is not found
        assert actual_sensitive_data is None

    @pytest.mark.asyncio
    async def test_db_find_one_throws_an_error(self, get_sensitive_personal_data_repository: Awaitable[SensitivePersonalDataRepository],
                                               mocker: pytest_mock.MockerFixture):
        repository = await get_sensitive_personal_data_repository

        # GIVEN the repository's collection's find_one function throws a given exception
        given_error = Exception('given error message')
        _find_by_user_id_path_spy = mocker.spy(repository._collection, 'find_one')
        _find_by_user_id_path_spy.side_effect = given_error

        # WHEN the find_by_user_id method is called for some random user id
        # THEN an error should be thrown
        with pytest.raises(Exception) as actual_error_info:
            await repository.find_by_user_id(get_random_printable_string(10))

        # AND the raised error message should be the same as given
        assert actual_error_info.value == given_error


class TestCreate:
    @pytest.mark.asyncio
    async def test_success(self, get_sensitive_personal_data_repository: Awaitable[SensitivePersonalDataRepository]):
        repository = await get_sensitive_personal_data_repository

        # GIVEN some sensitive personal data
        given_sensitive_data = _get_new_sensitive_personal_data()

        # WHEN the create method is called
        actual_inserted_id = await repository.create(given_sensitive_data)

        # THEN the inserted_id is returned as a string
        assert isinstance(actual_inserted_id, str)

        # AND the sensitive personal data can be found in the database with the inserted_id
        actual_sensitive_data = SensitivePersonalData.from_dict(
            await repository._collection.find_one({'_id': bson.ObjectId(actual_inserted_id)})
        )

        # AND the saved sensitive personal data is equal to the given data
        assert actual_sensitive_data == given_sensitive_data

    @pytest.mark.asyncio
    async def test_user_id_is_duplicated(self, get_sensitive_personal_data_repository: Awaitable[SensitivePersonalDataRepository]):
        repository = await get_sensitive_personal_data_repository

        # GIVEN some sensitive personal data
        given_sensitive_data = _get_new_sensitive_personal_data()

        # AND the sensitive personal data is already saved in the database
        inserted_id = await repository.create(given_sensitive_data)
        assert inserted_id is not None

        # WHEN the same sensitive personal data is saved again
        # THEN a DuplicateKeyError should be raised
        with pytest.raises(DuplicateKeyError):
            await repository.create(given_sensitive_data)

    @pytest.mark.asyncio
    async def test_db_insert_one_throws(self, get_sensitive_personal_data_repository: Awaitable[SensitivePersonalDataRepository],
                                        mocker: pytest_mock.MockerFixture):
        repository = await get_sensitive_personal_data_repository

        # GIVEN the repository's collection's insert_one function throws a given exception
        class _GivenError(Exception):
            pass

        given_error = _GivenError("given error message")
        # AND database insert_one throws an error
        _insert_one_spy = mocker.spy(repository._collection, 'insert_one')
        _insert_one_spy.side_effect = given_error

        # AND some sensitive personal data
        given_sensitive_data = _get_new_sensitive_personal_data()

        # WHEN the create method is called
        # THEN an exception is raised
        with pytest.raises(_GivenError) as actual_error_info:
            await repository.create(given_sensitive_data)

        # AND the raised error message raised should be the same as the given error
        assert actual_error_info.value == given_error


class TestStream:
    @pytest.mark.parametrize('given_n', [0, 1, 10, 100])
    @pytest.mark.asyncio
    async def test_success(self, get_sensitive_personal_data_repository: Awaitable[SensitivePersonalDataRepository], given_n: int):
        repository = await get_sensitive_personal_data_repository

        # GIVEN N sensitive personal data entries exist in the database
        given_sensitive_data = []
        if given_n > 0:
            for _ in range(given_n):
                given_sensitive_data.append(_get_new_sensitive_personal_data().model_dump())
            await repository._collection.insert_many(given_sensitive_data)

        # WHEN the stream method is called
        actual_iterator = repository.stream(batch_size=10)

        # THEN a valid actual_iterator is returned
        assert actual_iterator is not None

        # AND the actual_iterator can be iterated
        actual_entities = []
        async for item in actual_iterator:
            actual_entities.append(item)

        # AND the retrieved sensitive data should be equal to the given data
        assert len(actual_entities) == given_n
        assert actual_entities == [SensitivePersonalData.from_dict(data) for data in given_sensitive_data]

    @pytest.mark.asyncio
    async def test_db_find_throws_an_error(self, get_sensitive_personal_data_repository: Awaitable[SensitivePersonalDataRepository],
                                           mocker: pytest_mock.MockerFixture):
        repository = await get_sensitive_personal_data_repository

        # GIVEN the repository's collection's find function throws a given exception
        class _GivenError(Exception):
            pass

        _database_stream_spy = mocker.spy(repository._collection, 'find')
        given_exception = _GivenError('given error message')
        _database_stream_spy.side_effect = given_exception

        # WHEN the stream method is called and the returned iterator is iterated
        # THEN an exception should be raised
        with pytest.raises(_GivenError) as actual_error_info:
            actual_iterator = repository.stream(batch_size=10)
            async for _ in actual_iterator:
                pytest.fail("This should not be reached")

        # AND the raised error message should be the same as the given error
        assert actual_error_info.value == given_exception
