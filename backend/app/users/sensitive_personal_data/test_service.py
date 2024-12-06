"""
tests for the sensitive_personal_data service
"""

from typing import Optional

import pytest
from fastapi import HTTPException

from common_libs.test_utilities.random_data import get_random_printable_string
from app.users.sensitive_personal_data.types import SensitivePersonalData
from app.users.sensitive_personal_data.types import CreateSensitivePersonalDataRequest
from app.users.sensitive_personal_data.service import SensitivePersonalDataService
from app.users.sensitive_personal_data.repository import ISensitivePersonalDataRepository

# silence console output
# from common_libs.test_utilities.console_mock import mock_console

@pytest.fixture(scope='function')
def _mock_repository() -> ISensitivePersonalDataRepository:
    class MockedSensitivePersonalDataRepository(ISensitivePersonalDataRepository):
        async def create(self, sensitive_personal_data: SensitivePersonalData) -> Optional[str]: return None
        async def find_by_user_id(self, user_id: str) -> Optional[SensitivePersonalData]: return None
        async def stream(self, batch_size: int = 100): pass
    return MockedSensitivePersonalDataRepository()


def _get_new_create_sensitive_personal_data_request():
    # return a random user id and a new sensitive personal data
    return CreateSensitivePersonalDataRequest(
        aes_encryption_key=get_random_printable_string(10),
        rsa_key_id=get_random_printable_string(20),
        aes_encrypted_data=get_random_printable_string(100),
    )


class TestCreate:
    @pytest.mark.asyncio
    async def test_create_success(self, _mock_repository, mocker):
        # GIVEN sensitive personal data
        given_user_id = get_random_printable_string(10)

        # AND sensitive personal data request
        given_sensitive_data = _get_new_create_sensitive_personal_data_request()

        service = SensitivePersonalDataService(_mock_repository)
        _mock_repository.create = mocker.spy(_mock_repository, 'create')

        # WHEN we try to create sensitive personal data
        await service.create(given_user_id, given_sensitive_data)

        # THEN the repository.create should be called only once
        _mock_repository.create.assert_called_once()

        # AND the repository.create should be called with the given sensitive data
        actual_sensitive_data = _mock_repository.create.call_args[0][0]

        # we are not comparing all the fields because types are different.
        assert actual_sensitive_data.aes_encryption_key == given_sensitive_data.aes_encryption_key
        assert actual_sensitive_data.rsa_key_id == given_sensitive_data.rsa_key_id
        assert actual_sensitive_data.aes_encrypted_data == given_sensitive_data.aes_encrypted_data

    @pytest.mark.asyncio
    async def test_data_already_exists(self, _mock_repository, mocker):
        service = SensitivePersonalDataService(_mock_repository)

        # GIVEN sensitive personal data
        given_user_id = get_random_printable_string(10)

        # AND sensitive personal data request
        given_sensitive_data = _get_new_create_sensitive_personal_data_request()

        # AND repository.find_by_id returns valid sensitive user data.
        # => sensitive data already exists
        repository_find_by_user_id = mocker.patch.object(_mock_repository, 'find_by_user_id')
        repository_find_by_user_id.return_value = True

        # WHEN service.create throws an error
        # THEN an exception should be raised
        with pytest.raises(HTTPException) as error_info:
            await service.create(given_user_id, given_sensitive_data)

        # AND message should be 'sensitive personal data already exists'
        assert error_info.value.status_code == 409
        assert str(error_info.value) == '409: sensitive personal data already exists'

    @pytest.mark.asyncio
    async def test_repository_throws_an_error(self, _mock_repository, mocker):
        service = SensitivePersonalDataService(_mock_repository)

        # GIVEN sensitive personal data
        given_user_id = get_random_printable_string(10)

        # AND sensitive personal data request
        given_sensitive_data = _get_new_create_sensitive_personal_data_request()

        # AND given custom error with given error message
        given_error = Exception("given error message")

        # AND repository.find_by_id throws an error
        repository_find_by_user_id = mocker.patch.object(_mock_repository, 'find_by_user_id')
        repository_find_by_user_id.side_effect = given_error

        # WHEN service.create is called
        # THEN an exception should be raised
        with pytest.raises(HTTPException) as error_info:
            await service.create(given_user_id, given_sensitive_data)

        # AND the error should be the same as the given error
        assert str(error_info.value) == '500: Opps! Something went wrong.'


class TestExistsByUserId:
    @pytest.mark.asyncio
    async def test_exists_by_user_id_success_not_found(self, _mock_repository, mocker):
        # GIVEN sensitive personal data
        given_user_id = get_random_printable_string(10)

        # AND repository.find_by_id return None
        service = SensitivePersonalDataService(_mock_repository)

        repository_find_by_user_id = mocker.patch.object(_mock_repository, 'find_by_user_id')
        repository_find_by_user_id.return_value = None

        # WHEN we try to find sensitive data by user_id
        result = await service.exists_by_user_id(given_user_id)

        # THEN the sensitive data is not found
        assert result is False

    @pytest.mark.asyncio
    async def test_exists_by_user_id_success_found(self, _mock_repository, mocker):
        service = SensitivePersonalDataService(_mock_repository)

        # GIVEN sensitive personal data
        given_user_id = get_random_printable_string(10)

        # AND sensitive personal data request
        given_sensitive_data = _get_new_create_sensitive_personal_data_request()

        # AND repository.find_by_id return valid sensitive data
        repository_find_by_user_id = mocker.patch.object(_mock_repository, 'find_by_user_id')
        repository_find_by_user_id.return_value = given_sensitive_data

        # WHEN we try to find the sensitive personal data by user_id
        result = await service.exists_by_user_id(given_user_id)

        # THEN the sensitive data is found and True is returned
        assert result is True

    @pytest.mark.asyncio
    async def test_repository_throws_an_error(self, _mock_repository, mocker):
        service = SensitivePersonalDataService(_mock_repository)

        # GIVEN sensitive personal data
        given_user_id = get_random_printable_string(10)

        # AND given an error with given message
        given_error = Exception('given error message')

        # AND repository.find_by_id throws an error
        repository_find_by_user_id = mocker.patch.object(_mock_repository, 'find_by_user_id')
        repository_find_by_user_id.side_effect = given_error

        # WHEN we try to find sensitive personal data by user_id
        # THEN an exception should be raised.
        with pytest.raises(HTTPException) as exec_info:
            await service.exists_by_user_id(given_user_id)

        # AND an exception should be raised
        assert exec_info.value.status_code == 500
        assert str(exec_info.value) == '500: Opps! Something went wrong.'
