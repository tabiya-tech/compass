import pytest
from datetime import datetime, timedelta, timezone
from typing import Awaitable

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.users.cv.repository import UserCVRepository
from app.users.cv.types import UserCVUpload, UploadProcessState
from app.users.cv.errors import DuplicateCVUploadError
from common_libs import time_utilities as time_utils


@pytest.fixture(scope="function")
async def get_user_cv_repository(
        in_memory_userdata_database: Awaitable[AsyncIOMotorDatabase]) -> UserCVRepository:
    userdata_db = await in_memory_userdata_database
    repository = UserCVRepository(userdata_db)
    return repository


def _get_upload(*, user_id: str, created_at: datetime, suffix: str, markdown_len: int = 10, md5_hash: str = "test_hash_123") -> UserCVUpload:
    return UserCVUpload(
        user_id=user_id,
        created_at=created_at,
        filename=f"cv{suffix}.pdf",
        content_type="application/pdf",
        object_path=f"users/{user_id}/{suffix}/cv{suffix}.pdf",
        markdown_object_path=f"users/{user_id}/{suffix}/cv.md",
        markdown_char_len=markdown_len,
        md5_hash=md5_hash,
    )


def _assert_upload_doc_matches(actual: dict, given: UserCVUpload) -> None:
    assert actual["user_id"] == given.user_id
    assert actual["filename"] == given.filename
    assert actual["content_type"] == given.content_type
    assert actual["object_path"] == given.object_path
    assert actual["markdown_object_path"] == given.markdown_object_path
    assert actual["markdown_char_len"] == given.markdown_char_len
    assert actual["md5_hash"] == given.md5_hash
    assert actual["created_at"] == time_utils.convert_python_datetime_to_mongo_datetime(given.created_at)
    assert actual["upload_id"] == given.upload_id
    assert actual["upload_process_state"] == given.upload_process_state
    assert actual["cancel_requested"] == given.cancel_requested
    assert actual["last_activity_at"] == time_utils.convert_python_datetime_to_mongo_datetime(given.last_activity_at)


class TestUserCVRepository:
    @pytest.mark.asyncio
    async def test_insert_upload_persists_document(self, get_user_cv_repository: Awaitable[UserCVRepository]):
        # GIVEN a new upload
        repository = await get_user_cv_repository
        now = datetime.now(timezone.utc)
        given_user = "user-1"
        given_upload = _get_upload(user_id=given_user, created_at=now, suffix="1", md5_hash="unique_hash_001")

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
        recent_upload = _get_upload(user_id=user_id, created_at=now, suffix="r", md5_hash="recent_hash_123")
        older_upload = _get_upload(user_id=user_id, created_at=now - timedelta(minutes=5), suffix="o", md5_hash="older_hash_456")
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

    @pytest.mark.asyncio
    async def test_insert_upload_raises_duplicate_cv_error_for_same_user_and_hash(self, get_user_cv_repository: Awaitable[UserCVRepository]):
        repository = await get_user_cv_repository
        now = datetime.now(timezone.utc)
        user_id = "user-1"
        md5_hash = "same_hash_123"
        
        # GIVEN a first upload
        first_upload = _get_upload(user_id=user_id, created_at=now, suffix="1", md5_hash=md5_hash)
        await repository.insert_upload(first_upload)
        
        # GIVEN a second upload with same user_id and md5_hash
        second_upload = _get_upload(user_id=user_id, created_at=now, suffix="2", md5_hash=md5_hash)
        
        # WHEN inserting the second upload
        # THEN DuplicateCVUploadError is raised
        with pytest.raises(DuplicateCVUploadError) as exc_info:
            await repository.insert_upload(second_upload)
        
        assert exc_info.value.md5_hash == md5_hash

    @pytest.mark.asyncio
    async def test_insert_upload_allows_same_hash_for_different_users(self, get_user_cv_repository: Awaitable[UserCVRepository]):
        repository = await get_user_cv_repository
        now = datetime.now(timezone.utc)
        md5_hash = "same_hash_456"
        
        # GIVEN uploads from different users with same MD5 hash
        upload_user1 = _get_upload(user_id="user-1", created_at=now, suffix="1", md5_hash=md5_hash)
        upload_user2 = _get_upload(user_id="user-2", created_at=now, suffix="2", md5_hash=md5_hash)
        
        # WHEN inserting both uploads
        id1 = await repository.insert_upload(upload_user1)
        id2 = await repository.insert_upload(upload_user2)
        
        # THEN both should succeed (different users can have same file)
        assert id1 != id2
        assert isinstance(id1, str)
        assert isinstance(id2, str)

    @pytest.mark.asyncio
    async def test_get_upload_by_id_returns_upload(self, get_user_cv_repository: Awaitable[UserCVRepository]):
        repository = await get_user_cv_repository
        now = datetime.now(timezone.utc)
        user_id = "user-1"
        upload = _get_upload(user_id=user_id, created_at=now, suffix="1", md5_hash="test_hash_123")
        
        # GIVEN an uploaded document
        await repository.insert_upload(upload)
        
        # WHEN getting by upload_id
        result = await repository.get_upload_by_id(user_id, upload.upload_id)
        
        # THEN the document is returned
        assert result is not None
        assert result["upload_id"] == upload.upload_id
        assert result["user_id"] == user_id

    @pytest.mark.asyncio
    async def test_get_upload_by_id_returns_none_for_nonexistent(self, get_user_cv_repository: Awaitable[UserCVRepository]):
        repository = await get_user_cv_repository
        
        # WHEN getting non-existent upload
        result = await repository.get_upload_by_id("user-1", "nonexistent-upload-id")
        
        # THEN None is returned
        assert result is None

    @pytest.mark.asyncio
    async def test_request_cancellation_succeeds_for_active_upload(self, get_user_cv_repository: Awaitable[UserCVRepository]):
        repository = await get_user_cv_repository
        now = datetime.now(timezone.utc)
        user_id = "user-1"
        upload = _get_upload(user_id=user_id, created_at=now, suffix="1", md5_hash="test_hash_123")
        upload.upload_process_state = UploadProcessState.UPLOADING
        
        # GIVEN an active upload
        await repository.insert_upload(upload)
        
        # WHEN requesting cancellation
        success = await repository.request_cancellation(user_id, upload.upload_id)
        
        # THEN cancellation succeeds
        assert success is True
        
        # AND the document is updated
        updated_doc = await repository.get_upload_by_id(user_id, upload.upload_id)
        assert updated_doc["cancel_requested"] is True

    @pytest.mark.asyncio
    async def test_request_cancellation_fails_for_completed_upload(self, get_user_cv_repository: Awaitable[UserCVRepository]):
        repository = await get_user_cv_repository
        now = datetime.now(timezone.utc)
        user_id = "user-1"
        upload = _get_upload(user_id=user_id, created_at=now, suffix="1", md5_hash="test_hash_123")
        upload.upload_process_state = UploadProcessState.COMPLETED
        
        # GIVEN a completed upload
        await repository.insert_upload(upload)
        
        # WHEN requesting cancellation
        success = await repository.request_cancellation(user_id, upload.upload_id)
        
        # THEN cancellation fails
        assert success is False
        
        # AND the document is unchanged
        updated_doc = await repository.get_upload_by_id(user_id, upload.upload_id)
        assert updated_doc["cancel_requested"] is False

    @pytest.mark.asyncio
    async def test_atomic_state_transition_succeeds(self, get_user_cv_repository: Awaitable[UserCVRepository]):
        repository = await get_user_cv_repository
        now = datetime.now(timezone.utc)
        user_id = "user-1"
        upload = _get_upload(user_id=user_id, created_at=now, suffix="1", md5_hash="test_hash_123")
        upload.upload_process_state = UploadProcessState.UPLOADING
        
        # GIVEN an upload in UPLOADING state
        await repository.insert_upload(upload)
        
        # WHEN transitioning to CONVERTING
        success = await repository.atomic_state_transition(
            user_id, upload.upload_id,
            from_states=[UploadProcessState.UPLOADING],
            to_state=UploadProcessState.CONVERTING
        )
        
        # THEN transition succeeds
        assert success is True
        
        # AND the document is updated
        updated_doc = await repository.get_upload_by_id(user_id, upload.upload_id)
        assert updated_doc["upload_process_state"] == UploadProcessState.CONVERTING

    @pytest.mark.asyncio
    async def test_atomic_state_transition_fails_for_wrong_state(self, get_user_cv_repository: Awaitable[UserCVRepository]):
        repository = await get_user_cv_repository
        now = datetime.now(timezone.utc)
        user_id = "user-1"
        upload = _get_upload(user_id=user_id, created_at=now, suffix="1", md5_hash="test_hash_123")
        upload.upload_process_state = UploadProcessState.CONVERTING
        
        # GIVEN an upload in CONVERTING state
        await repository.insert_upload(upload)
        
        # WHEN trying to transition from UPLOADING (wrong state)
        success = await repository.atomic_state_transition(
            user_id, upload.upload_id,
            from_states=[UploadProcessState.UPLOADING],
            to_state=UploadProcessState.UPLOADING_TO_GCS
        )
        
        # THEN transition fails
        assert success is False
        
        # AND the document is unchanged
        updated_doc = await repository.get_upload_by_id(user_id, upload.upload_id)
        assert updated_doc["upload_process_state"] == UploadProcessState.CONVERTING

    @pytest.mark.asyncio
    async def test_atomic_state_transition_fails_for_cancelled_upload(self, get_user_cv_repository: Awaitable[UserCVRepository]):
        repository = await get_user_cv_repository
        now = datetime.now(timezone.utc)
        user_id = "user-1"
        upload = _get_upload(user_id=user_id, created_at=now, suffix="1", md5_hash="test_hash_123")
        upload.upload_process_state = UploadProcessState.UPLOADING
        upload.cancel_requested = True
        
        # GIVEN an upload with cancellation requested
        await repository.insert_upload(upload)
        
        # WHEN trying to transition state
        success = await repository.atomic_state_transition(
            user_id, upload.upload_id,
            from_states=[UploadProcessState.UPLOADING],
            to_state=UploadProcessState.CONVERTING
        )
        
        # THEN transition fails (cancellation takes precedence)
        assert success is False
        
        # AND the document is unchanged
        updated_doc = await repository.get_upload_by_id(user_id, upload.upload_id)
        assert updated_doc["upload_process_state"] == UploadProcessState.UPLOADING

    @pytest.mark.asyncio
    async def test_atomic_state_transition_handles_concurrent_updates(self, get_user_cv_repository: Awaitable[UserCVRepository]):
        repository = await get_user_cv_repository
        now = datetime.now(timezone.utc)
        user_id = "user-1"
        upload = _get_upload(user_id=user_id, created_at=now, suffix="1", md5_hash="test_hash_123")
        upload.upload_process_state = UploadProcessState.UPLOADING
        
        # GIVEN an upload in UPLOADING state
        await repository.insert_upload(upload)
        
        # WHEN two concurrent transitions are attempted
        # (simulating race condition)
        success1 = await repository.atomic_state_transition(
            user_id, upload.upload_id,
            from_states=[UploadProcessState.UPLOADING],
            to_state=UploadProcessState.CONVERTING
        )
        
        success2 = await repository.atomic_state_transition(
            user_id, upload.upload_id,
            from_states=[UploadProcessState.UPLOADING],
            to_state=UploadProcessState.CONVERTING
        )
        
        # THEN only one should succeed
        assert (success1 and not success2) or (not success1 and success2)
        
        # AND the final state should be CONVERTING
        final_doc = await repository.get_upload_by_id(user_id, upload.upload_id)
        assert final_doc["upload_process_state"] == UploadProcessState.CONVERTING


