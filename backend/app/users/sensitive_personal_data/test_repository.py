"""
This module contains the tests for the SensitivePersonalDataRepository class.
It uses the users_mocked database, and tests if repository methods work as expected with actual data.
"""
import bson
import pytest
from datetime import datetime

from pymongo.errors import DuplicateKeyError

from app.users.sensitive_personal_data.types import SensitivePersonalData
from app.users.sensitive_personal_data.repository import SensitivePersonalDataRepository
from app.server_dependencies.database_collections import Collections
from common_libs.test_utilities.random_data import get_random_printable_string


def _get_new_sensitive_personal_data():
    return SensitivePersonalData(
        user_id=get_random_printable_string(10),
        aes_encryption_key=get_random_printable_string(10),
        rsa_key_id=get_random_printable_string(20),
        aes_encrypted_data=get_random_printable_string(100),
        created_at=datetime.now()
    )


class TestFindById:
    @pytest.mark.asyncio
    async def test_success(self, mocked_users_database):
        users_db = await mocked_users_database

        # GIVEN sensitive personal data
        given_sensitive_data = _get_new_sensitive_personal_data()

        # AND the data is saved in the database
        await users_db.get_collection(Collections.SENSITIVE_PERSONAL_DATA).insert_one(given_sensitive_data.model_dump())

        # WHEN we try to find the sensitive data by user_id
        repository = SensitivePersonalDataRepository(users_db)
        actual_sensitive_data = await repository.find_by_user_id(given_sensitive_data.user_id)

        # THEN the sensitive personal data is found
        # AND it is equal to the same sensitive data in the database
        assert actual_sensitive_data == given_sensitive_data

    @pytest.mark.asyncio
    async def test_find_by_id_not_found(self, mocked_users_database):
        users_db = await mocked_users_database
        repository = SensitivePersonalDataRepository(users_db)

        # GIVEN some random user id
        given_user_id = get_random_printable_string(10)

        # WHEN we try to find sensitive data by user_id
        actual_sensitive_data = await repository.find_by_user_id(given_user_id)

        # THEN the sensitive personal data is not found
        assert actual_sensitive_data is None

    @pytest.mark.asyncio
    async def test_find_by_id_throws_an_error(self, mocked_users_database, mocker):
        users_db = await mocked_users_database
        repository = SensitivePersonalDataRepository(users_db)

        # GIVEN some random user id
        given_user_id = get_random_printable_string(10)

        # AND some random error
        given_error = Exception('given error message')

        # AND repository find one throws an error
        repository_find_by_id = mocker.spy(repository._collection, 'find_one')
        repository_find_by_id.side_effect = given_error

        # WHEN we try to find sensitive data by user_id
        # THEN an error should be thrown
        with pytest.raises(Exception) as error_info:
            await repository.find_by_user_id(given_user_id)

        # AND error message should be the same as given
        assert error_info.value == given_error


class TestCreate:
    @pytest.mark.asyncio
    async def test_success(self, mocked_users_database):
        users_db = await mocked_users_database
        repository = SensitivePersonalDataRepository(users_db)

        # GIVEN some sensitive personal data
        given_sensitive_data = _get_new_sensitive_personal_data()

        # WHEN we create the sensitive personal data in the db.
        actual_inserted_id = await repository.create(given_sensitive_data)

        # THEN the inserted_id is returned as a string
        assert isinstance(actual_inserted_id, str)

        # AND the sensitive personal data is saved in the database
        actual_sensitive_data = SensitivePersonalData.from_dict(
            await users_db.get_collection(Collections.SENSITIVE_PERSONAL_DATA)
            .find_one({'_id': bson.ObjectId(actual_inserted_id)})
        )

        # AND the saved sensitive personal data is equal to the given data
        assert actual_sensitive_data == given_sensitive_data

    @pytest.mark.asyncio
    async def test_user_id_is_duplicated(self, mocked_users_database):
        users_db = await mocked_users_database

        # GIVEN sensitive personal data
        given_sensitive_data = _get_new_sensitive_personal_data()

        # AND a repository of sensitive personal data is constructed
        repository = SensitivePersonalDataRepository(users_db)

        # WHEN sensitive personal data is already saved in the database
        await repository.create(given_sensitive_data)

        # AND we try to create the same sensitive personal data
        # THEN the sensitive personal data is not created
        # AND an exception is raised because the user_id is duplicated
        with pytest.raises(DuplicateKeyError):
            await repository.create(given_sensitive_data)

    @pytest.mark.asyncio
    async def test_database_throws(self, mocked_users_database, mocker):
        users_db = await mocked_users_database
        repository = SensitivePersonalDataRepository(users_db)

        class _GivenError(Exception):
            ...

        # GIVEN sensitive personal data request
        given_sensitive_data = _get_new_sensitive_personal_data()
        
        # AND an error is thrown when trying to insert the sensitive personal data
        given_error = _GivenError("given error message")

        # AND database insert_one throws an error
        repository_insert_one = mocker.spy(repository._collection, 'insert_one')
        repository_insert_one.side_effect = given_error

        # WHEN we try to create the sensitive personal data
        # THEN an exception is raised
        with pytest.raises(_GivenError) as exception_info:
            await repository.create(given_sensitive_data)

        # AND the error message should be the same as the given error
        assert exception_info.value == given_error


class TestStream:
    @pytest.mark.parametrize('test_data', [0, 1, 10, 100])
    @pytest.mark.asyncio
    async def test_stream_success(self, mocked_users_database, test_data):
        users_db = await mocked_users_database
        repository = SensitivePersonalDataRepository(users_db)

        # GIVEN a sensitive personal data request body is created
        given_sensitive_data = []
        for _ in range(test_data):
            given_sensitive_data.append(_get_new_sensitive_personal_data().model_dump())

        # AND sensitive data is saved in the database
        if test_data > 0:
            await users_db.get_collection(Collections.SENSITIVE_PERSONAL_DATA).insert_many(given_sensitive_data)

        # WHEN we try to stream the sensitive data
        actual_cursor = repository.stream(batch_size=10)

        # THEN the cursor is not None
        assert actual_cursor is not None

        # AND the sensitive data is streamed in batches
        # AND every sensitive data is equal to the given data
        actual_entities = []
        async for item in actual_cursor:
            actual_entities.append(item)

        # AND the sensitive data should be equal to the given data
        assert len(actual_entities) == test_data
        assert actual_entities == [SensitivePersonalData.from_dict(data) for data in given_sensitive_data]

    @pytest.mark.asyncio
    async def test_stream_throws_an_error(self, mocked_users_database, mocker):
        users_db = await mocked_users_database
        repository = SensitivePersonalDataRepository(users_db)

        class _GivenError(Exception):
            ...

        # GIVEN collection find by id throws an exception
        database_stream = mocker.spy(repository._collection, 'find')
        given_exception = _GivenError('given error message')
        database_stream.side_effect = given_exception

        # WHEN we try to stream the sensitive data
        # THEN an exception should be raised
        with pytest.raises(_GivenError) as error_info:
            cursor = repository.stream(batch_size=10)
            async for _ in cursor:
                ...

        # AND the error message should be the same as the given error
        assert given_exception == error_info.value
