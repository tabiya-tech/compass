"""
tests for the sensitive_personal_data service
"""
from datetime import datetime, timezone
from typing import Optional

import pytest
import pytest_mock

from common_libs.test_utilities.random_data import get_random_printable_string
from app.users.sensitive_personal_data.types import SensitivePersonalData, SensitivePersonalDataRequirement, \
    EncryptedSensitivePersonalData, CreateSensitivePersonalDataRequest
from app.users.sensitive_personal_data.service import SensitivePersonalDataService
from app.users.sensitive_personal_data.errors import (
    DuplicateSensitivePersonalDataError,
    UserPreferencesNotFoundError,
    SensitivePersonalDataRequiredError,
    SensitivePersonalDataNotAvailableError
)
from app.users.sensitive_personal_data.repository import ISensitivePersonalDataRepository
from app.users.repositories import IUserPreferenceRepository
from app.users.types import UserPreferences, UserPreferencesRepositoryUpdateRequest


@pytest.fixture(scope='function')
def _mock_sensitive_personal_data_repository() -> ISensitivePersonalDataRepository:
    class MockedSensitivePersonalDataRepository(ISensitivePersonalDataRepository):
        async def create(self, sensitive_personal_data: SensitivePersonalData) -> Optional[str]:
            return None

        async def find_by_user_id(self, user_id: str) -> Optional[SensitivePersonalData]:
            return None

        async def exists_by_user_id(self, user_id: str) -> bool:
            result = await self.find_by_user_id(user_id)
            return result is not None

        async def stream(self, discard_skipped: bool, batch_size: int = 100):  # The stream method is not used by the service layer
            raise NotImplementedError

    return MockedSensitivePersonalDataRepository()


@pytest.fixture(scope='function')
def _mock_user_preference_repository() -> IUserPreferenceRepository:
    class MockedUserPreferenceRepository(IUserPreferenceRepository):
        async def get_user_preference_by_user_id(self, user_id: str) -> Optional[UserPreferences]:
            return UserPreferences(
                sensitive_personal_data_requirement=SensitivePersonalDataRequirement.NOT_REQUIRED
            )

        async def insert_user_preference(self, user_id: str, user_preference: UserPreferences) -> UserPreferences:
            return user_preference

        async def update_user_preference(self, user_id: str, update: UserPreferencesRepositoryUpdateRequest) -> UserPreferences:
            return UserPreferences(
                sensitive_personal_data_requirement=SensitivePersonalDataRequirement.NOT_REQUIRED
            )

    return MockedUserPreferenceRepository()


def _get_new_create_sensitive_personal_data_request():
    # return a random user id and a new sensitive personal data
    return CreateSensitivePersonalDataRequest(
        sensitive_personal_data=EncryptedSensitivePersonalData(
            aes_encryption_key=get_random_printable_string(10),
            rsa_key_id=get_random_printable_string(20),
            aes_encrypted_data=get_random_printable_string(100),
        )
    )


class TestCreate:
    @pytest.mark.asyncio
    async def test_success(self, _mock_sensitive_personal_data_repository: ISensitivePersonalDataRepository,
                           _mock_user_preference_repository: IUserPreferenceRepository,
                           mocker: pytest_mock.MockerFixture):
        # GIVEN a user id
        given_user_id = get_random_printable_string(10)

        # AND a create sensitive personal data request
        given_sensitive_data_request = _get_new_create_sensitive_personal_data_request()

        # WHEN the create method is called by the given authenticated user with the given user id and sensitive data
        service = SensitivePersonalDataService(_mock_sensitive_personal_data_repository,
                                               _mock_user_preference_repository)
        _create_spy = mocker.spy(_mock_sensitive_personal_data_repository, 'create')
        await service.create(given_user_id, given_sensitive_data_request)

        # THEN the repository.create should be called only once
        _create_spy.assert_called_once()

        # get the actual sensitive data passed to the repository.create
        actual_sensitive_data = _create_spy.call_args[0][0]
        # AND the repository.create should be called with the given user id
        assert actual_sensitive_data.user_id == given_user_id
        # AND the repository.create should be called with the given sensitive data
        assert actual_sensitive_data.sensitive_personal_data == given_sensitive_data_request.sensitive_personal_data

    @pytest.mark.asyncio
    async def test_data_already_exists(self, _mock_sensitive_personal_data_repository: ISensitivePersonalDataRepository,
                                       _mock_user_preference_repository: IUserPreferenceRepository,
                                       mocker: pytest_mock.MockerFixture):
        # GIVEN a user id
        given_user_id = get_random_printable_string(10)

        # AND a create sensitive personal data request
        given_sensitive_data = _get_new_create_sensitive_personal_data_request()

        # AND the repository.find_by_id returns valid sensitive user data for the given user id
        _find_by_user_id_pathed = mocker.patch.object(_mock_sensitive_personal_data_repository, 'find_by_user_id')
        _find_by_user_id_pathed.return_value = SensitivePersonalData(
            user_id=given_user_id,
            created_at=datetime.now(timezone.utc),
            sensitive_personal_data=given_sensitive_data.sensitive_personal_data
        )

        # WHEN the create method is called with the given user id and sensitive data
        # THEN an exception should be raised
        with pytest.raises(DuplicateSensitivePersonalDataError) as actual_error_info:
            service = SensitivePersonalDataService(_mock_sensitive_personal_data_repository,
                                                   _mock_user_preference_repository)
            await service.create(given_user_id, given_sensitive_data)

        # AND the exception should have the same user id as the given user id
        assert str(actual_error_info.value) == f"Sensitive personal data already exists for user {given_user_id}"

    @pytest.mark.asyncio
    async def test_not_available(self, _mock_sensitive_personal_data_repository: ISensitivePersonalDataRepository,
                                 _mock_user_preference_repository: IUserPreferenceRepository,
                                 mocker: pytest_mock.MockerFixture):
        # GIVEN a user id
        given_user_id = get_random_printable_string(10)

        # AND the user's sensitive personal data is not available due to an invitation code requirement
        _get_preferences_patched = mocker.patch.object(_mock_user_preference_repository,
                                                       'get_user_preference_by_user_id')
        _get_preferences_patched.return_value = UserPreferences(
            sensitive_personal_data_requirement=SensitivePersonalDataRequirement.NOT_AVAILABLE
        )

        # WHEN the create method is called
        service = SensitivePersonalDataService(_mock_sensitive_personal_data_repository,
                                               _mock_user_preference_repository)
        # THEN a SensitivePersonalDataNotAvailableError should be raised
        with pytest.raises(SensitivePersonalDataNotAvailableError) as error_info:
            await service.create(given_user_id, _get_new_create_sensitive_personal_data_request())
        assert str(error_info.value) == f"Sensitive personal data is not available for user {given_user_id}"

    @pytest.mark.asyncio
    async def test_user_preferences_not_found(self,
                                              _mock_sensitive_personal_data_repository: ISensitivePersonalDataRepository,
                                              _mock_user_preference_repository: IUserPreferenceRepository,
                                              mocker: pytest_mock.MockerFixture):
        # GIVEN a user id
        given_user_id = get_random_printable_string(10)

        # AND the user preferences are not found
        _get_preferences_patched = mocker.patch.object(_mock_user_preference_repository,
                                                       'get_user_preference_by_user_id')
        _get_preferences_patched.return_value = None

        # WHEN the create method is called
        service = SensitivePersonalDataService(_mock_sensitive_personal_data_repository,
                                               _mock_user_preference_repository)
        # THEN a UserPreferencesNotFoundError should be raised
        with pytest.raises(UserPreferencesNotFoundError) as error_info:
            await service.create(given_user_id, _get_new_create_sensitive_personal_data_request())
        assert str(error_info.value) == f"User preferences not found for user {given_user_id}"

    @pytest.mark.asyncio
    async def test_repository_throws_an_error(self,
                                              _mock_sensitive_personal_data_repository: ISensitivePersonalDataRepository,
                                              _mock_user_preference_repository: IUserPreferenceRepository,
                                              mocker: pytest_mock.MockerFixture):
        # GIVEN the repository.find_by_id throws some error
        given_error = Exception("given error message")
        _find_by_user_id_pathed = mocker.patch.object(_mock_sensitive_personal_data_repository, 'find_by_user_id')
        _find_by_user_id_pathed.side_effect = given_error

        # WHEN the service.create is called for some random user id and sensitive data create request
        # THEN an exception should be raised
        with pytest.raises(Exception) as error_info:
            service = SensitivePersonalDataService(_mock_sensitive_personal_data_repository,
                                                   _mock_user_preference_repository)
            given_user_id = get_random_printable_string(10)
            given_sensitive_data = _get_new_create_sensitive_personal_data_request()
            await service.create(given_user_id, given_sensitive_data)

        # AND the error message should be the same as the given error
        assert str(error_info.value) == str(given_error)


class TestSkip:
    @pytest.mark.asyncio
    async def test_success(self, _mock_sensitive_personal_data_repository: ISensitivePersonalDataRepository,
                           _mock_user_preference_repository: IUserPreferenceRepository,
                           mocker: pytest_mock.MockerFixture):
        # GIVEN a user id
        given_user_id = get_random_printable_string(10)

        # WHEN the skip method is called
        service = SensitivePersonalDataService(_mock_sensitive_personal_data_repository,
                                               _mock_user_preference_repository)
        _create_spy = mocker.spy(_mock_sensitive_personal_data_repository, 'create')
        await service.skip(given_user_id)

        # THEN the repository.create should be called only once
        _create_spy.assert_called_once()

        # get the actual sensitive data passed to the repository.create
        actual_sensitive_data = _create_spy.call_args[0][0]
        # AND the repository.create should be called with the given user id
        assert actual_sensitive_data.user_id == given_user_id
        # AND sensitive_personal_data should be None
        assert actual_sensitive_data.sensitive_personal_data is None

    @pytest.mark.asyncio
    async def test_skipping_not_allowed_when_pii_required(self,
                                                          _mock_sensitive_personal_data_repository: ISensitivePersonalDataRepository,
                                                          _mock_user_preference_repository: IUserPreferenceRepository,
                                                          mocker: pytest_mock.MockerFixture):
        # GIVEN a user id
        given_user_id = get_random_printable_string(10)

        # AND the user's sensitive personal data is required
        _get_preferences_patched = mocker.patch.object(_mock_user_preference_repository,
                                                       'get_user_preference_by_user_id')
        _get_preferences_patched.return_value = UserPreferences(
            sensitive_personal_data_requirement=SensitivePersonalDataRequirement.REQUIRED
        )

        # WHEN the skip method is called
        service = SensitivePersonalDataService(_mock_sensitive_personal_data_repository,
                                               _mock_user_preference_repository)
        # THEN a SensitivePersonalDataRequiredError should be raised
        with pytest.raises(SensitivePersonalDataRequiredError) as error_info:
            await service.skip(given_user_id)
        assert str(
            error_info.value) == f"Sensitive personal data is required for user {given_user_id} and cannot be skipped"

    @pytest.mark.asyncio
    async def test_skipping_not_allowed_when_pii_not_available(self, _mock_sensitive_personal_data_repository: ISensitivePersonalDataRepository,
                                                               _mock_user_preference_repository: IUserPreferenceRepository,
                                                               mocker: pytest_mock.MockerFixture):
        # GIVEN a user id
        given_user_id = get_random_printable_string(10)

        # AND the user's sensitive personal data is not available
        _get_preferences_patched = mocker.patch.object(_mock_user_preference_repository,
                                                       'get_user_preference_by_user_id')
        _get_preferences_patched.return_value = UserPreferences(
            sensitive_personal_data_requirement=SensitivePersonalDataRequirement.NOT_AVAILABLE
        )

        # WHEN the skip method is called
        service = SensitivePersonalDataService(_mock_sensitive_personal_data_repository,
                                               _mock_user_preference_repository)
        # THEN a SensitivePersonalDataNotAvailableError should be raised
        with pytest.raises(SensitivePersonalDataNotAvailableError) as error_info:
            await service.skip(given_user_id)
        assert str(error_info.value) == f"Sensitive personal data is not available for user {given_user_id}"

    @pytest.mark.asyncio
    async def test_user_preferences_not_found(self,
                                              _mock_sensitive_personal_data_repository: ISensitivePersonalDataRepository,
                                              _mock_user_preference_repository: IUserPreferenceRepository,
                                              mocker: pytest_mock.MockerFixture):
        # GIVEN a user id
        given_user_id = get_random_printable_string(10)

        # AND the user preferences are not found
        _get_preferences_patched = mocker.patch.object(_mock_user_preference_repository,
                                                       'get_user_preference_by_user_id')
        _get_preferences_patched.return_value = None

        # WHEN the skip method is called
        service = SensitivePersonalDataService(_mock_sensitive_personal_data_repository,
                                               _mock_user_preference_repository)
        # THEN a UserPreferencesNotFoundError should be raised
        with pytest.raises(UserPreferencesNotFoundError) as error_info:
            await service.skip(given_user_id)
        assert str(error_info.value) == f"User preferences not found for user {given_user_id}"

    @pytest.mark.asyncio
    async def test_repository_throws_an_error(self,
                                              _mock_sensitive_personal_data_repository: ISensitivePersonalDataRepository,
                                              _mock_user_preference_repository: IUserPreferenceRepository,
                                              mocker: pytest_mock.MockerFixture):
        # GIVEN a user id
        given_user_id = get_random_printable_string(10)

        # AND the repository.create throws some error
        given_error = Exception("given error message")
        _create_patched = mocker.patch.object(_mock_sensitive_personal_data_repository, 'create')
        _create_patched.side_effect = given_error

        # WHEN the skip method is called
        service = SensitivePersonalDataService(_mock_sensitive_personal_data_repository,
                                               _mock_user_preference_repository)
        # THEN an exception should be raised
        with pytest.raises(Exception) as error_info:
            await service.skip(given_user_id)

        # AND the error message should be the same as given
        assert str(error_info.value) == str(given_error)


class TestExistsByUserId:
    @pytest.mark.asyncio
    async def test_not_found(self, _mock_sensitive_personal_data_repository: ISensitivePersonalDataRepository,
                             _mock_user_preference_repository: IUserPreferenceRepository, mocker):
        # GIVEN sensitive personal data
        given_user_id = get_random_printable_string(10)

        # AND repository.find_by_id return None
        _find_by_user_id_pathed = mocker.patch.object(_mock_sensitive_personal_data_repository, 'find_by_user_id')
        _find_by_user_id_pathed.return_value = None

        # WHEN the exists_by_user_id method is called for the given user id
        service = SensitivePersonalDataService(_mock_sensitive_personal_data_repository,
                                               _mock_user_preference_repository)
        result = await service.exists_by_user_id(given_user_id)

        # THEN the sensitive data is not found
        assert result is False

    @pytest.mark.asyncio
    async def test_found(self, _mock_sensitive_personal_data_repository: ISensitivePersonalDataRepository,
                         _mock_user_preference_repository: IUserPreferenceRepository, mocker):
        # GIVEN a user id
        given_user_id = get_random_printable_string(10)

        # AND a create sensitive personal data request
        given_sensitive_data = _get_new_create_sensitive_personal_data_request()

        # AND repository.find_by_id returns the given sensitive data
        _find_by_user_id_pathed = mocker.patch.object(_mock_sensitive_personal_data_repository, 'find_by_user_id')
        _find_by_user_id_pathed.return_value = given_sensitive_data

        # WHEN the exists_by_user_id method is called for the given user id
        service = SensitivePersonalDataService(_mock_sensitive_personal_data_repository,
                                               _mock_user_preference_repository)
        result = await service.exists_by_user_id(given_user_id)

        # THEN it should return True
        assert result is True

    @pytest.mark.asyncio
    async def test_repository_throws_an_error(self,
                                              _mock_sensitive_personal_data_repository: ISensitivePersonalDataRepository,
                                              _mock_user_preference_repository: IUserPreferenceRepository,
                                              mocker: pytest_mock.MockerFixture):
        # GIVEN the repository.find_by_id throws some error
        given_error = Exception("given error message")
        _find_by_user_id_pathed = mocker.patch.object(_mock_sensitive_personal_data_repository, 'find_by_user_id')
        _find_by_user_id_pathed.side_effect = given_error

        # WHEN the service.exists_by_user_id is called for some random user id
        # THEN an exception should be raised
        with pytest.raises(Exception) as error_info:
            service = SensitivePersonalDataService(_mock_sensitive_personal_data_repository,
                                                   _mock_user_preference_repository)
            await service.exists_by_user_id(get_random_printable_string(10))

        # AND the error message should be the same as given
        assert str(error_info.value) == str(given_error)
