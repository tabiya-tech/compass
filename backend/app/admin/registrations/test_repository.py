"""Tests for the AdminRegistrationRepository."""
import pytest
from typing import Awaitable

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.admin.registrations.repository import AdminRegistrationRepository
from app.admin.registrations.types import (
    CreateRegistrationRequest,
    DuplicateActiveRegistrationError,
    RegistrationRoleRequest,
    RegistrationStatus,
)
from common_libs.time_utilities import get_now


@pytest.fixture(scope="function")
async def get_repository(
    in_memory_application_database: Awaitable[AsyncIOMotorDatabase],
) -> AdminRegistrationRepository:
    application_db = await in_memory_application_database
    return AdminRegistrationRepository(application_db)


def _instructor_request(email: str = "alice@school.edu") -> CreateRegistrationRequest:
    return CreateRegistrationRequest(
        email=email,
        name="Alice Test",
        requested_role=RegistrationRoleRequest.INSTITUTION_STAFF,
        institution_id="some-institution-id",
    )


def _admin_request(email: str = "bob@org.edu") -> CreateRegistrationRequest:
    return CreateRegistrationRequest(
        email=email,
        name="Bob Test",
        requested_role=RegistrationRoleRequest.ADMIN,
        institution_id=None,
    )


class TestCreateOrReplacePending:
    @pytest.mark.asyncio
    async def test_creates_new_pending_row(
        self, get_repository: Awaitable[AdminRegistrationRepository]
    ):
        repository = await get_repository
        # GIVEN a fresh registration request
        given_request = _instructor_request()

        # WHEN submitted
        actual = await repository.create_or_replace_pending(given_request)

        # THEN a pending row is persisted with the given fields (email lowercased)
        assert actual.email == given_request.email.lower()
        assert actual.name == given_request.name
        assert actual.requested_role == RegistrationRoleRequest.INSTITUTION_STAFF
        assert actual.institution_id == given_request.institution_id
        assert actual.status == RegistrationStatus.PENDING
        assert actual.id is not None
        assert actual.decided_by is None

    @pytest.mark.asyncio
    async def test_raises_when_active_pending_already_exists(
        self, get_repository: Awaitable[AdminRegistrationRepository]
    ):
        repository = await get_repository
        # GIVEN an existing pending row
        given_request = _admin_request()
        await repository.create_or_replace_pending(given_request)

        # WHEN a second request comes in for the same email
        # THEN it raises DuplicateActiveRegistrationError
        with pytest.raises(DuplicateActiveRegistrationError):
            await repository.create_or_replace_pending(given_request)

    @pytest.mark.asyncio
    async def test_raises_when_active_approved_already_exists(
        self, get_repository: Awaitable[AdminRegistrationRepository]
    ):
        repository = await get_repository
        # GIVEN an existing approved row
        given_request = _admin_request()
        first = await repository.create_or_replace_pending(given_request)
        await repository.mark_decided(
            first.id,
            status=RegistrationStatus.APPROVED,
            decided_by="some-super-admin",
            decided_at=get_now(),
        )

        # WHEN a new request comes in for the same email
        # THEN it raises DuplicateActiveRegistrationError
        with pytest.raises(DuplicateActiveRegistrationError):
            await repository.create_or_replace_pending(given_request)

    @pytest.mark.asyncio
    async def test_overwrites_rejected_row_on_resubmit(
        self, get_repository: Awaitable[AdminRegistrationRepository]
    ):
        repository = await get_repository
        # GIVEN a rejected row for the email
        given_request = _admin_request()
        first = await repository.create_or_replace_pending(given_request)
        await repository.mark_decided(
            first.id,
            status=RegistrationStatus.REJECTED,
            decided_by="some-super-admin",
            decided_at=get_now(),
            rejection_reason="not affiliated",
        )

        # WHEN the user resubmits with a different name
        resubmit = CreateRegistrationRequest(
            email=given_request.email,
            name="Bob Resubmitted",
            requested_role=RegistrationRoleRequest.ADMIN,
        )
        actual = await repository.create_or_replace_pending(resubmit)

        # THEN a new pending row exists with the new name (the rejected row is replaced)
        assert actual.status == RegistrationStatus.PENDING
        assert actual.name == "Bob Resubmitted"
        assert await repository.count_pending() == 1


class TestGetByEmail:
    @pytest.mark.asyncio
    async def test_lookup_is_case_insensitive(
        self, get_repository: Awaitable[AdminRegistrationRepository]
    ):
        repository = await get_repository
        # GIVEN a row stored with a lower-cased email
        given_request = _admin_request(email="MixedCase@org.edu")
        await repository.create_or_replace_pending(given_request)

        # WHEN looking up by an upper-cased version
        actual = await repository.get_by_email("MIXEDCASE@ORG.EDU")

        # THEN the row is found
        assert actual is not None
        assert actual.email == "mixedcase@org.edu"

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(
        self, get_repository: Awaitable[AdminRegistrationRepository]
    ):
        repository = await get_repository
        # GIVEN no rows
        # WHEN looking up an unknown email
        actual = await repository.get_by_email("ghost@nowhere.io")
        # THEN None is returned
        assert actual is None


class TestCountPending:
    @pytest.mark.asyncio
    async def test_counts_only_pending(
        self, get_repository: Awaitable[AdminRegistrationRepository]
    ):
        repository = await get_repository
        # GIVEN one pending and one approved row
        pending = await repository.create_or_replace_pending(_instructor_request("alice@a.edu"))
        approved = await repository.create_or_replace_pending(_admin_request("bob@b.edu"))
        await repository.mark_decided(
            approved.id,
            status=RegistrationStatus.APPROVED,
            decided_by="some-super-admin",
            decided_at=get_now(),
        )

        # WHEN counting pending
        actual_count = await repository.count_pending()

        # THEN only the pending row is counted
        assert actual_count == 1
        assert pending.id is not None  # silence unused


class TestDeleteByEmail:
    @pytest.mark.asyncio
    async def test_deletes_all_rows_for_a_matching_email(
        self, get_repository: Awaitable[AdminRegistrationRepository]
    ):
        repository = await get_repository
        # GIVEN one approved row for the target email
        target_email = "delete.me@school.edu"
        approved = await repository.create_or_replace_pending(_instructor_request(target_email))
        await repository.mark_decided(
            approved.id,
            status=RegistrationStatus.APPROVED,
            decided_by="super-1",
            decided_at=get_now(),
        )
        # AND an unrelated pending row for a different email
        await repository.create_or_replace_pending(_admin_request("keep.me@org.edu"))

        # WHEN delete_by_email is called for the target email
        actual_deleted = await repository.delete_by_email(target_email)

        # THEN the matching row is removed and the unrelated row remains
        assert actual_deleted == 1
        assert await repository.get_by_email(target_email) is None
        assert await repository.get_by_email("keep.me@org.edu") is not None

    @pytest.mark.asyncio
    async def test_lowercases_the_lookup_email(
        self, get_repository: Awaitable[AdminRegistrationRepository]
    ):
        repository = await get_repository
        # GIVEN a row stored under the lowercased email
        await repository.create_or_replace_pending(_instructor_request("Alice@School.edu"))

        # WHEN delete_by_email is called with a mixed-case variant of the same address
        actual_deleted = await repository.delete_by_email("ALICE@school.edu")

        # THEN the row is matched and deleted (lookup is case-insensitive)
        assert actual_deleted == 1

    @pytest.mark.asyncio
    async def test_returns_zero_when_no_row_matches(
        self, get_repository: Awaitable[AdminRegistrationRepository]
    ):
        repository = await get_repository
        # GIVEN a populated collection that doesn't include the target email
        await repository.create_or_replace_pending(_admin_request("someone.else@org.edu"))

        # WHEN delete_by_email is called for a non-matching email
        actual_deleted = await repository.delete_by_email("nobody@nowhere.io")

        # THEN nothing is deleted
        assert actual_deleted == 0


class TestMarkDecided:
    @pytest.mark.asyncio
    async def test_persists_decided_by_and_at(
        self, get_repository: Awaitable[AdminRegistrationRepository]
    ):
        repository = await get_repository
        # GIVEN a pending registration
        registration = await repository.create_or_replace_pending(_admin_request())

        # WHEN marked as approved
        given_super_admin_uid = "super-admin-uid-123"
        given_decided_at = get_now()
        actual = await repository.mark_decided(
            registration.id,
            status=RegistrationStatus.APPROVED,
            decided_by=given_super_admin_uid,
            decided_at=given_decided_at,
        )

        # THEN decided fields are persisted
        assert actual is not None
        assert actual.status == RegistrationStatus.APPROVED
        assert actual.decided_by == given_super_admin_uid
        assert actual.decided_at is not None
