import logging
import random
import uuid
from typing import Awaitable
from datetime import datetime, timedelta, timezone

import pytest
import pytest_mock

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.invitations.repository import UserInvitationRepository
from app.invitations.types import UserInvitation, InvitationType
from app.users.sensitive_personal_data.types import SensitivePersonalDataRequirement

from common_libs import time_utilities as time_utils
from common_libs.test_utilities import get_custom_error


@pytest.fixture(scope="function")
async def get_user_invitation_data_repository(
        in_memory_application_database: Awaitable[AsyncIOMotorDatabase]) -> UserInvitationRepository:
    application_db = await in_memory_application_database
    repository = UserInvitationRepository(application_db)
    return repository


def _get_new_invitation():
    """
    Returns a new invitation object with random data for testing purposes.
    """
    # generate a random number between 1 and 1000
    max_capacity = random.randint(10, 1000)  # nosec B311 # random is used for testing purposes
    random_time_delta = timedelta(hours=random.randint(-23, 23))  # nosec B311 # random is used for testing purposes
    random_tz = timezone(random_time_delta, name="Foo")
    return UserInvitation(
        invitation_code=str(uuid.uuid4()),  # Generate a random invitation code
        allowed_usage=max_capacity,
        remaining_usage=max_capacity - random.randint(1, max_capacity),  # nosec B311 # random is used for testing purposes
        valid_from=datetime.now().astimezone(tz=random_tz),  # construct a date in the past in the given time zone
        # create a date 1-10 days in the future in the given time zone.
        valid_until=datetime.now().astimezone(tz=random_tz) + timedelta(days=random.randint(1, 10)),  #nosec B311 # random is used for testing purposes
        # Generate a random invitation type
        invitation_type=random.choice(list(InvitationType)),  # nosec B311 # random is used for testing purposes
        sensitive_personal_data_requirement=random.choice(list(SensitivePersonalDataRequirement))  # nosec B311 # random is used for testing purposes
        # Generate a random sensitive personal data requirement
    )


async def _prefill_random_invitations(repository: UserInvitationRepository, n: int):
    """
    Inserts N random invitations into the database.
    """
    invitations = [_get_new_invitation() for _ in range(n)]
    await repository.upsert_many_invitations(invitations)


def _assert_invitation_matches(actual_invitation_code: dict, given_invitation: UserInvitation):
    assert actual_invitation_code["invitation_code"] == given_invitation.invitation_code
    assert actual_invitation_code["allowed_usage"] == given_invitation.allowed_usage
    assert actual_invitation_code["remaining_usage"] == given_invitation.remaining_usage
    assert actual_invitation_code["invitation_type"] == given_invitation.invitation_type.value

    assert time_utils.mongo_date_to_datetime(actual_invitation_code["valid_from"]) == time_utils.truncate_microseconds(
        given_invitation.valid_from)

    assert time_utils.mongo_date_to_datetime(actual_invitation_code["valid_until"]) == time_utils.truncate_microseconds(
        given_invitation.valid_until)

    assert (actual_invitation_code["sensitive_personal_data_requirement"] == given_invitation
            .sensitive_personal_data_requirement.value)


class TestUpsertManyInvitations:
    @pytest.mark.asyncio
    async def test_insert_new(self, get_user_invitation_data_repository: Awaitable[UserInvitationRepository]):
        repository = await get_user_invitation_data_repository
        # GIVEN N new invitation codes
        given_n = 5
        given_invitations = [
            _get_new_invitation() for _ in range(given_n)
        ]
        # WHEN the upsert_many_invitation_codes method is called with the given invitation codes.
        await repository.upsert_many_invitations(given_invitations)
        # THEN the invitation codes are inserted into the database
        for given_invitation in given_invitations:
            actual_invitation_code = await repository._collection.find_one(
                {"invitation_code": given_invitation.invitation_code})
            # compare the actual invitation code with the expected invitation code
            _assert_invitation_matches(actual_invitation_code, given_invitation)

    @pytest.mark.asyncio
    async def test_update_existing(self, get_user_invitation_data_repository: Awaitable[UserInvitationRepository]):
        # GIVEN N new invitation codes already exist in the database
        given_n = 5
        given_invitations = [
            _get_new_invitation() for _ in range(given_n)
        ]
        repository = await get_user_invitation_data_repository
        await repository.upsert_many_invitations(given_invitations)

        # AND the invitation properties of one of the given invitations are updated (except the invitation code)
        given_updated_index = 1
        updated_invitation = _get_new_invitation()
        updated_invitation.invitation_code = given_invitations[given_updated_index].invitation_code

        # WHEN the upsert_many_invitation_codes method is called with the updated invitation.
        await repository.upsert_many_invitations([updated_invitation])

        # THEN the invitations with the given_updated_index updated in the database,
        # while the other invitation codes remain the same.
        for i, given_invitation in enumerate(given_invitations):
            actual_invitation_code = await repository._collection.find_one(
                {"invitation_code": given_invitation.invitation_code})
            # compare the actual invitation code with the expected invitation code
            _given_invitation = updated_invitation if i == given_updated_index else given_invitation
            assert actual_invitation_code["invitation_code"] == _given_invitation.invitation_code
            assert actual_invitation_code["allowed_usage"] == _given_invitation.allowed_usage
            assert actual_invitation_code["remaining_usage"] == _given_invitation.remaining_usage
            assert actual_invitation_code["valid_from"] == time_utils.convert_python_datetime_to_mongo_datetime(
                _given_invitation.valid_from)
            assert actual_invitation_code["valid_until"] == time_utils.convert_python_datetime_to_mongo_datetime(
                _given_invitation.valid_until)
            assert actual_invitation_code["invitation_type"] == _given_invitation.invitation_type.value
            assert (actual_invitation_code["sensitive_personal_data_requirement"] ==
                    _given_invitation.sensitive_personal_data_requirement.value)

    @pytest.mark.asyncio
    async def test_bulk_write_throws_an_error(
            self,
            caplog: pytest.LogCaptureFixture,
            mocker: pytest_mock.MockerFixture,
            get_user_invitation_data_repository: Awaitable[UserInvitationRepository]):
        repository = await get_user_invitation_data_repository

        # GIVEN N new invitation codes
        given_n = 5
        given_invitations = [
            _get_new_invitation() for _ in range(given_n)
        ]

        # AND repository._collection.bulk_write will throw an exception.
        error_class, given_error = get_custom_error()
        _bulk_write_spy = mocker.patch.object(
            repository._collection,
            'bulk_write',
            side_effect=given_error)

        # WHEN the upsert_many_invitation_codes method is called with the given invitation codes
        # THEN an exception is raised.
        with pytest.raises(error_class) as actual_error_info, caplog.at_level(logging.DEBUG):
            await repository.upsert_many_invitations(given_invitations)

        # AND the raised error message raised should be the same as the given error.
        assert actual_error_info.value == given_error

        # AND the logger.exception should be called with given_error.message.
        assert str(given_error) in caplog.text


class TestGetValidInvitationByCode:
    @pytest.mark.asyncio
    async def test_find_valid(self, get_user_invitation_data_repository: Awaitable[UserInvitationRepository]):
        # GIVEN N valid invitation exists in the database.
        repository = await get_user_invitation_data_repository
        # GIVEN N valid invitation codes
        given_n = 5
        given_invitations = [
            _get_new_invitation() for _ in range(given_n)
        ]
        await repository.upsert_many_invitations(given_invitations)

        # WHEN the get_valid_invitation_by_code function is called with every given invitation codes.
        for i, given_invitation in enumerate(given_invitations):
            actual_invitation = await repository.get_valid_invitation_by_code(given_invitation.invitation_code)
            assert actual_invitation.invitation_code == given_invitation.invitation_code
            assert actual_invitation.allowed_usage == given_invitation.allowed_usage
            assert actual_invitation.remaining_usage == given_invitation.remaining_usage
            assert actual_invitation.valid_from == time_utils.truncate_microseconds(given_invitation.valid_from)
            assert actual_invitation.valid_until == time_utils.truncate_microseconds(given_invitation.valid_until)
            assert actual_invitation.invitation_type == given_invitation.invitation_type
            assert (actual_invitation.sensitive_personal_data_requirement ==
                    given_invitation.sensitive_personal_data_requirement)

    @pytest.mark.asyncio
    async def test_valid_not_found(self, get_user_invitation_data_repository: Awaitable[UserInvitationRepository]):
        # GIVEN N valid invitation exists in the database.
        repository = await get_user_invitation_data_repository
        # GIVEN N valid invitation codes
        given_n = 5
        given_invitations = [
            _get_new_invitation() for _ in range(given_n)
        ]
        # AND one that is invalid because it has a remaining usage of 0.
        invalid_invitation_capacity = _get_new_invitation()
        invalid_invitation_capacity.remaining_usage = 0
        given_invitations.append(invalid_invitation_capacity)
        # AND one that is invalid because it is expired
        invalid_invitation_expired = _get_new_invitation()
        invalid_invitation_expired.valid_until = datetime.now().astimezone() - timedelta(days=1)
        given_invitations.append(invalid_invitation_expired)
        # AND one that is invalid because it is not yet valid.
        invalid_invitation_not_yet = _get_new_invitation()
        invalid_invitation_not_yet.valid_from = datetime.now().astimezone() + timedelta(days=1)
        given_invitations.append(invalid_invitation_not_yet)
        await repository.upsert_many_invitations(given_invitations)
        #
        # WHEN the get_valid_invitation_by_code function is called with the invitation codes.
        for i, given_invitation in enumerate(given_invitations):
            actual_invitation = await repository.get_valid_invitation_by_code(given_invitation.invitation_code)
            # THEN the function should return None for the invalid invitations, and the invitation for the valid ones.
            if given_invitation.invitation_code in [invalid_invitation_capacity.invitation_code,
                                                    invalid_invitation_expired.invitation_code,
                                                    invalid_invitation_not_yet.invitation_code]:
                assert actual_invitation is None
            else:
                assert actual_invitation.invitation_code == given_invitation.invitation_code

    @pytest.mark.asyncio
    async def test_find_one_throws_an_error(
            self,
            caplog: pytest.LogCaptureFixture,
            mocker: pytest_mock.MockerFixture,
            get_user_invitation_data_repository: Awaitable[UserInvitationRepository]):
        repository = await get_user_invitation_data_repository

        # GIVEN an invitation is already saved in the database.
        given_invitation = _get_new_invitation()
        await repository.upsert_many_invitations([given_invitation])

        # AND repository._collection.find_one will throw an exception.
        error_class, given_error = get_custom_error()
        _find_one_spy = mocker.patch.object(
            repository._collection,
            'find_one',
            side_effect=given_error)

        # WHEN the get_valid_invitation_by_code function is called.
        # THEN an exception is raised.
        with pytest.raises(error_class) as actual_error_info, caplog.at_level(logging.DEBUG):
            await repository.get_valid_invitation_by_code(given_invitation.invitation_code)

        # AND the raised error message raised should be the same as the given error.
        assert actual_error_info.value == given_error

        # AND the logger.exception should be called with given_error.message.
        assert str(given_error) in caplog.text


class TestReduceCapacity:
    @pytest.mark.asyncio
    async def test_successfully_reduced_capacity(
            self, get_user_invitation_data_repository: Awaitable[UserInvitationRepository]):
        repository = await get_user_invitation_data_repository

        # GIVEN already N invitations in the database.
        await _prefill_random_invitations(repository, 5)

        # AND a given invitation is already saved in the database.
        given_invitation = _get_new_invitation()
        await repository.upsert_many_invitations([given_invitation])

        # WHEN the reduce capacity function is called.
        actual_is_reduced = await repository.reduce_capacity(given_invitation.invitation_code)

        # THEN the function should return True
        assert actual_is_reduced

        # AND the capacity of the actual invitation in the database should be reduced by 1.
        actual_invitation = await repository._collection.find_one({"invitation_code": given_invitation.invitation_code})
        assert actual_invitation.get("remaining_usage") == given_invitation.remaining_usage - 1

        # AND no other fields should be updated, expected the reduced remaining usage.
        given_invitation.remaining_usage = given_invitation.remaining_usage - 1
        _assert_invitation_matches(actual_invitation, given_invitation)

    @pytest.mark.asyncio
    async def test_invitation_code_not_found(
            self,
            get_user_invitation_data_repository: Awaitable[UserInvitationRepository]):
        repository = await get_user_invitation_data_repository

        # GIVEN N invitations are prefilled in the database.
        await _prefill_random_invitations(repository, 5)

        # AND a given invitation is not saved in the database.
        given_invitation_code = str(uuid.uuid4())
        # GUARD CLAUSE: Ensure the given invitation code is not in the database.
        assert await repository._collection.find_one({"invitation_code": given_invitation_code}) is None

        # WHEN the reduce capacity function is called.
        actual_is_reduced = await repository.reduce_capacity(given_invitation_code)

        # THEN the function should return False
        assert not actual_is_reduced

    @pytest.mark.asyncio
    @pytest.mark.parametrize("update, expected_message", [
        ({"remaining_usage": 0}, "Invitation usage limit reached"),
        ({"valid_from": time_utils.get_now() + timedelta(days=1)}, "Invitation not yet valid"),
        ({"valid_until": time_utils.get_now() - timedelta(days=1)}, "Invitation already expired"),
    ])
    async def test_reduce_capacity_invalid(
            self,
            update: dict,
            expected_message: str,
            get_user_invitation_data_repository: Awaitable[UserInvitationRepository]):
        repository = await get_user_invitation_data_repository

        # Given N invitations are prefilled in the database.
        await _prefill_random_invitations(repository, 5)

        # AND a given invalid invitation is saved in the database.
        given_invitation = _get_new_invitation()

        # AND the given invitation is updated with the given update.
        given_invitation = given_invitation.model_copy(update=update)
        await repository.upsert_many_invitations([given_invitation])

        # WHEN the reduce capacity function is called.
        actual_is_reduced = await repository.reduce_capacity(given_invitation.invitation_code)

        # THEN the function should return False
        assert not actual_is_reduced

        # AND the invitation code should not be changed.
        actual_invitation = await repository._collection.find_one({"invitation_code": given_invitation.invitation_code})
        _assert_invitation_matches(actual_invitation, given_invitation)

    @pytest.mark.asyncio
    async def test_find_one_and_update_is_not_atomic(
            self,
            mocker: pytest_mock.MockerFixture,
            get_user_invitation_data_repository: Awaitable[UserInvitationRepository]):
        repository = await get_user_invitation_data_repository

        # GIVEN an invitation is already saved in the database.
        given_invitation = _get_new_invitation()
        await repository.upsert_many_invitations([given_invitation])

        # AND repository._collection.find_one_and_update will return a negative remaining usage.
        _find_one_and_update_spy = mocker.patch.object(
            repository._collection,
            'find_one_and_update',
            new_callable=pytest_mock.AsyncMockType,
            return_value={"remaining_usage": -1})

        # WHEN the reduce capacity function is called.
        actual_is_reduced = await repository.reduce_capacity(given_invitation.invitation_code)

        # THEN the function should return False
        assert not actual_is_reduced

    @pytest.mark.asyncio
    async def test_collection_find_one_and_update_throws(
            self,
            mocker: pytest_mock.MockerFixture,
            caplog: pytest.LogCaptureFixture,
            get_user_invitation_data_repository: Awaitable[UserInvitationRepository]):
        repository = await get_user_invitation_data_repository

        # GIVEN an invitation is already saved in the database.
        given_invitation = _get_new_invitation()
        await repository.upsert_many_invitations([given_invitation])

        # AND repository._collection.update_one will throw an exception.
        error_class, given_error = get_custom_error()
        _update_one_spy = mocker.patch.object(
            repository._collection,
            'find_one_and_update',
            side_effect=given_error)

        # WHEN the reduce capacity function is called.
        # THEN an exception is raised.
        with pytest.raises(error_class) as actual_error_info, caplog.at_level(logging.DEBUG):
            await repository.reduce_capacity(given_invitation.invitation_code)

        # AND the raised error message raised should be the same as the given error.
        assert actual_error_info.value == given_error

        # AND the logger.exception should be called with given_error.message.
        assert str(given_error) in caplog.text
