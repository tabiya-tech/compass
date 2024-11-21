"""
tests for the sensitive_personal_data service
"""
from datetime import datetime
from typing import Optional

import pytest
import pytest_mock

from common_libs.test_utilities.random_data import get_random_printable_string
from app.users.sensitive_personal_data.types import SensitivePersonalData
from app.users.sensitive_personal_data.types import CreateSensitivePersonalDataRequest
from app.users.sensitive_personal_data.service import SensitivePersonalDataService, DuplicateSensitivePersonalDataError
from app.users.sensitive_personal_data.repository import ISensitivePersonalDataRepository


@pytest.fixture(scope='function')
def _mock_repository() -> ISensitivePersonalDataRepository:
    class MockedSensitivePersonalDataRepository(ISensitivePersonalDataRepository):
        async def create(self, sensitive_personal_data: SensitivePersonalData) -> Optional[str]:
            return None

        async def find_by_user_id(self, user_id: str) -> Optional[SensitivePersonalData]:
            return None

        async def stream(self, batch_size: int = 100):  # The stream method is not used by the service layer
            raise NotImplementedError

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
    async def test_success(self, _mock_repository: ISensitivePersonalDataRepository, mocker: pytest_mock.MockerFixture):
        # GIVEN a user id
        given_user_id = get_random_printable_string(10)

        # AND a create sensitive personal data request
        given_sensitive_data = _get_new_create_sensitive_personal_data_request()

        # WHEN the create method is called by the given authenticated user with the given user id and sensitive data
        service = SensitivePersonalDataService(_mock_repository)
        _create_spy = mocker.spy(_mock_repository, 'create')
        await service.create(given_user_id, given_sensitive_data)

        # THEN the repository.create should be called only once
        _create_spy.assert_called_once()

        # get the actual sensitive data passed to the repository.create
        actual_sensitive_data = _create_spy.call_args[0][0]
        # AND the repository.create should be called with the given user id
        assert actual_sensitive_data.user_id == given_user_id
        # AND the repository.create should be called with the given sensitive data
        assert actual_sensitive_data.aes_encryption_key == given_sensitive_data.aes_encryption_key
        assert actual_sensitive_data.rsa_key_id == given_sensitive_data.rsa_key_id
        assert actual_sensitive_data.aes_encrypted_data == given_sensitive_data.aes_encrypted_data

    @pytest.mark.asyncio
    async def test_data_already_exists(self, _mock_repository: ISensitivePersonalDataRepository, mocker: pytest_mock.MockerFixture):
        # GIVEN a user id
        given_user_id = get_random_printable_string(10)

        # AND a create sensitive personal data request
        given_sensitive_data = _get_new_create_sensitive_personal_data_request()

        # AND the repository.find_by_id returns valid sensitive user data for the given user id
        _find_by_user_id_pathed = mocker.patch.object(_mock_repository, 'find_by_user_id')
        _find_by_user_id_pathed.return_value = SensitivePersonalData(
            user_id=given_user_id,
            rsa_key_id=given_sensitive_data.rsa_key_id,
            aes_encryption_key=given_sensitive_data.aes_encryption_key,
            aes_encrypted_data=given_sensitive_data.aes_encrypted_data,
            created_at=datetime.now()
        )

        # WHEN the create method is called with the given user id and sensitive data
        # THEN an exception should be raised
        with pytest.raises(DuplicateSensitivePersonalDataError) as actual_error_info:
            service = SensitivePersonalDataService(_mock_repository)
            await service.create(given_user_id, given_sensitive_data)

        # AND the exception should have the same user id as the given user id
        assert str(actual_error_info.value) == str(DuplicateSensitivePersonalDataError(given_user_id))

    @pytest.mark.asyncio
    async def test_repository_throws_an_error(self, _mock_repository: ISensitivePersonalDataRepository, mocker: pytest_mock.MockerFixture):
        # GIVEN the repository.find_by_id throws some error
        given_error = Exception("given error message")
        _find_by_user_id_pathed = mocker.patch.object(_mock_repository, 'find_by_user_id')
        _find_by_user_id_pathed.side_effect = given_error

        # WHEN the service.create is called for some random user id and sensitive data create request
        # THEN an exception should be raised
        with pytest.raises(Exception) as error_info:
            service = SensitivePersonalDataService(_mock_repository)
            given_user_id = get_random_printable_string(10)
            given_sensitive_data = _get_new_create_sensitive_personal_data_request()
            await service.create(given_user_id, given_sensitive_data)

        # AND the error message should be 'Opps! Something went wrong.'
        assert str(error_info.value) == str(given_error)


class TestExistsByUserId:
    @pytest.mark.asyncio
    async def test_not_found(self, _mock_repository: ISensitivePersonalDataRepository, mocker):
        # GIVEN sensitive personal data
        given_user_id = get_random_printable_string(10)

        # AND repository.find_by_id return None
        _find_by_user_id_pathed = mocker.patch.object(_mock_repository, 'find_by_user_id')
        _find_by_user_id_pathed.return_value = None

        # WHEN the exists_by_user_id method is called for the given user id
        service = SensitivePersonalDataService(_mock_repository)
        result = await service.exists_by_user_id(given_user_id)

        # THEN the sensitive data is not found
        assert result is False

    @pytest.mark.asyncio
    async def test_found(self, _mock_repository: ISensitivePersonalDataRepository, mocker):
        # GIVEN a user id
        given_user_id = get_random_printable_string(10)

        # AND a create sensitive personal data request
        given_sensitive_data = _get_new_create_sensitive_personal_data_request()

        # AND repository.find_by_id returns the given sensitive data
        _find_by_user_id_pathed = mocker.patch.object(_mock_repository, 'find_by_user_id')
        _find_by_user_id_pathed.return_value = given_sensitive_data

        # WHEN the exists_by_user_id method is called for the given user id
        service = SensitivePersonalDataService(_mock_repository)
        result = await service.exists_by_user_id(given_user_id)

        # THEN it should return True
        assert result is True

    @pytest.mark.asyncio
    async def test_repository_throws_an_error(self, _mock_repository: ISensitivePersonalDataRepository, mocker):
        # GIVEN the repository.find_by_id throws some error
        given_error = Exception("given error message")
        _find_by_user_id_pathed = mocker.patch.object(_mock_repository, 'find_by_user_id')
        _find_by_user_id_pathed.side_effect = given_error

        # WHEN the service.exists_by_user_id is called for some random user id
        # THEN an exception should be raised
        with pytest.raises(Exception) as error_info:
            service = SensitivePersonalDataService(_mock_repository)
            await service.exists_by_user_id(get_random_printable_string(10))

        # AND the error message should be the same as given
        assert str(error_info.value) == str(given_error)
