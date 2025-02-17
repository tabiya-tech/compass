import json
import os
from datetime import datetime
from typing import Awaitable

import pytest
import pytest_mock
import pydantic_core
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.invitations import UserInvitationRepository, UserInvitation
from import_invitations import import_invitations
from common_libs.time_utilities import mongo_date_to_datetime, truncate_microseconds


current_dir = os.path.dirname(os.path.abspath(__file__))


@pytest.fixture(scope="function")
async def get_user_invitation_data_repository(
        in_memory_application_database: Awaitable[AsyncIOMotorDatabase]) -> UserInvitationRepository:
    application_db = await in_memory_application_database
    repository = UserInvitationRepository(application_db)
    return repository


class TestImportInvitationsUnitTests:
    @pytest.mark.asyncio
    async def test_successfully_imported(
            self,
            mocker: pytest_mock.MockerFixture,
            get_user_invitation_data_repository: Awaitable[UserInvitationRepository]):

        repository = await get_user_invitation_data_repository
        repository_upsert_many_invitations = mocker.patch.object(repository, "upsert_many_invitations")

        # GIVEN an array of valid dictionaries matching invitations schema (Imported from ./sample.json)
        with open(os.path.join(current_dir, "sample.json")) as f:
            given_invitations = json.load(f)

        # WHEN the import_invitations function should is called.
        await import_invitations(repository, given_invitations)

        # THEN the upsert_many_invitations function should be called once.
        assert repository_upsert_many_invitations.call_count == 1

        # AND the upsert_many_invitations function should be called with the valid UserInvitation.
        repository_upsert_many_invitations.assert_called_once_with(
            [UserInvitation(**invitation_dict) for invitation_dict in given_invitations])

    @pytest.mark.asyncio
    async def test_invalid_request(
            self,
            get_user_invitation_data_repository: Awaitable[UserInvitationRepository]):
        repository = await get_user_invitation_data_repository

        # GIVEN a list of invitation dictionaries to be imported.
        with open(os.path.join(current_dir, "sample.json")) as f:
            given_invitations = json.load(f)

        # AND the first invitation dictionary is missing the "invitation_code" key.
        given_invitations[0].pop("invitation_code")

        # WHEN the import_invitations function is called.
        # THEN it should raise a pydantic Validation Error.
        with pytest.raises(pydantic_core._pydantic_core.ValidationError):
            await import_invitations(repository, given_invitations)


class TestImportInvitationsIntegrationTests:
    @pytest.mark.asyncio
    async def test_integration_import_invitations(
            self,
            get_user_invitation_data_repository: Awaitable[UserInvitationRepository]):
        repository = await get_user_invitation_data_repository

        # GIVEN an array of valid dictionaries with invitations.
        with open(os.path.join(current_dir, "sample.json")) as f:
            given_invitations = json.load(f)

        # WHEN the invitations are imported in the database.
        await import_invitations(repository, given_invitations)

        # THEN for each invitation dictionary, the invitation dict should be present in the database.
        for given_invitation in given_invitations:
            actual_invitations = await repository._collection.find_one({
                "invitation_code": given_invitation["invitation_code"]})

            assert actual_invitations["invitation_code"] == given_invitation["invitation_code"]
            assert actual_invitations["remaining_usage"] == given_invitation["remaining_usage"]
            assert actual_invitations["invitation_type"] == given_invitation["invitation_type"]
            assert actual_invitations["allowed_usage"] == given_invitation["allowed_usage"]

            assert (mongo_date_to_datetime(actual_invitations["valid_from"])
                    == truncate_microseconds(datetime.fromisoformat(given_invitation["valid_from"])))
            assert (mongo_date_to_datetime(actual_invitations["valid_until"])
                    == truncate_microseconds(datetime.fromisoformat(given_invitation["valid_until"])))
            assert (actual_invitations["sensitive_personal_data_requirement"]
                    == given_invitation["sensitive_personal_data_requirement"])
