import pytest
from datetime import datetime, timedelta, timezone
from typing import Awaitable

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.users.cv.repository import UserCVRepository
from app.users.cv.types import UserCVUpload
from common_libs import time_utilities as time_utils


@pytest.fixture(scope="function")
async def get_user_cv_repository(
        in_memory_userdata_database: Awaitable[AsyncIOMotorDatabase]) -> UserCVRepository:
    userdata_db = await in_memory_userdata_database
    repository = UserCVRepository(userdata_db)
    return repository


def _get_upload(*, user_id: str, created_at: datetime, suffix: str, markdown_len: int = 10) -> UserCVUpload:
    return UserCVUpload(
        user_id=user_id,
        created_at=created_at,
        filename=f"cv{suffix}.pdf",
        content_type="application/pdf",
        object_path=f"users/{user_id}/{suffix}/cv{suffix}.pdf",
        markdown_object_path=f"users/{user_id}/{suffix}/cv.md",
        markdown_char_len=markdown_len,
    )


def _assert_upload_doc_matches(actual: dict, given: UserCVUpload) -> None:
    assert actual["user_id"] == given.user_id
    assert actual["filename"] == given.filename
    assert actual["content_type"] == given.content_type
    assert actual["object_path"] == given.object_path
    assert actual["markdown_object_path"] == given.markdown_object_path
    assert actual["markdown_char_len"] == given.markdown_char_len
    # created_at is stored as Mongo date
    assert actual["created_at"] == time_utils.convert_python_datetime_to_mongo_datetime(given.created_at)


class TestUserCVRepository:
    @pytest.mark.asyncio
    async def test_insert_upload_persists_document(self, get_user_cv_repository: Awaitable[UserCVRepository]):
        # GIVEN a new upload
        repository = await get_user_cv_repository
        now = datetime.now(timezone.utc)
        given_user = "user-1"
        given_upload = _get_upload(user_id=given_user, created_at=now, suffix="1")

        # WHEN inserting the upload
        inserted_id = await repository.insert_upload(given_upload)

        # THEN it is stored in the collection
        assert isinstance(inserted_id, str)
        actual_doc = await repository._collection.find_one({"user_id": given_user, "filename": given_upload.filename})
        _assert_upload_doc_matches(actual_doc, given_upload)

    @pytest.mark.asyncio
    async def test_count_uploads_and_window(self, get_user_cv_repository: Awaitable[UserCVRepository]):
        repository = await get_user_cv_repository
        user_id = "user-1"
        now = datetime.now(timezone.utc)

        # GIVEN two uploads, one recent and one 5 minutes ago
        recent_upload = _get_upload(user_id=user_id, created_at=now, suffix="r")
        older_upload = _get_upload(user_id=user_id, created_at=now - timedelta(minutes=5), suffix="o")
        await repository.insert_upload(recent_upload)
        await repository.insert_upload(older_upload)

        # WHEN counting all
        total = await repository.count_uploads_for_user(user_id)
        # THEN
        assert total == 2

        # WHEN counting in a 1 minute window
        recent = await repository.count_uploads_for_user_in_window(user_id, minutes=1)
        # THEN only the recent one is counted
        assert recent == 1

    @pytest.mark.asyncio
    async def test_count_uploads_window_none(self, get_user_cv_repository: Awaitable[UserCVRepository]):
        repository = await get_user_cv_repository
        # GIVEN no uploads for this user
        user_id = "user-2"
        # WHEN counting in a 1 minute window
        recent = await repository.count_uploads_for_user_in_window(user_id, minutes=1)
        # THEN zero is returned
        assert recent == 0


