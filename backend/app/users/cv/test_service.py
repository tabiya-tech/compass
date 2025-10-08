import pytest

import asyncio
from app.users.cv.service import CVUploadService
from app.users.cv.types import CVUploadErrorCode, UserCVUpload
from app.users.cv.errors import CVLimitExceededError, CVUploadRateLimitExceededError, DuplicateCVUploadError
from app.users.cv.repository import IUserCVRepository
from app.users.cv.storage import ICVCloudStorageService
from app.users.cv.types import UserCVUpload


class MockCVRepository(IUserCVRepository):
    """Mock repository for testing."""

    async def insert_upload(self, upload: UserCVUpload) -> str:
        return "mock_id"

    async def count_uploads_for_user(self, user_id: str) -> int:
        return 0

    async def count_uploads_for_user_in_window(self, user_id: str, *, minutes: int) -> int:
        return 0

    async def get_upload_by_id(self, user_id: str, upload_id: str) -> dict | None:
        return None

    async def get_upload_by_upload_id(self, upload_id: str) -> dict | None:
        return None

    async def request_cancellation(self, user_id: str, upload_id: str) -> bool:
        return True

    async def atomic_state_transition(self, user_id: str, upload_id: str, *,
                                      from_states: list, to_state) -> bool:
        return True

    async def update_state(self, user_id: str, upload_id: str, *, to_state) -> bool:
        return True

    async def mark_cancelled(self, user_id: str, upload_id: str) -> bool:
        return True

    async def mark_failed(self, user_id: str, upload_id: str, *, error_code: str, error_detail: str) -> bool:
        return True

    async def store_experiences(self, user_id: str, upload_id: str, *, experiences: list[str]) -> bool:
        return True


class MockCVCloudStorageService(ICVCloudStorageService):
    """Mock storage service for testing."""

    def upload_cv(self, *, document: UserCVUpload, markdown_text: str,
                  original_bytes: bytes) -> None:  # Noncompliant - we keep this method empty cause its a mock for a test
        pass


class TestCVUploadService:
    @pytest.mark.asyncio
    async def test_parse_cv_returns_upload_id_and_empty_experiences_immediately(self, mocker):
        # GIVEN input bytes and filename
        given_bytes = b"%PDF-1.4 ..."
        given_filename = "resume.pdf"

        # WHEN parsing the CV in the service (immediate response design)
        service = CVUploadService(repository=MockCVRepository(), cv_cloud_storage_service=MockCVCloudStorageService())
        mocker.patch("app.users.cv.service.get_application_config", mocker.Mock(return_value=type("C", (), {
            "cv_max_uploads_per_user": 999,
            "cv_rate_limit_per_minute": 999,
        })()))
        result = await service.parse_cv(
            user_id="user-1",
            file_bytes=given_bytes,
            filename=given_filename,
        )

        # THEN immediate response contains an upload_id and empty experiences list
        assert isinstance(result, str) and len(result) > 0

    @pytest.mark.asyncio
    async def test_pipeline_failure_sets_error_code_timeout(self, mocker):
        # GIVEN a repository spy to observe mark_failed
        class RepoSpy(MockCVRepository):
            pass

        repo = RepoSpy()
        service = CVUploadService(repository=repo, cv_cloud_storage_service=MockCVCloudStorageService())
        mocker.patch("app.users.cv.service.get_application_config", mocker.Mock(return_value=type("C", (), {
            "cv_max_uploads_per_user": 999,
            "cv_rate_limit_per_minute": 999,
        })()))

        # AND cause the conversion call to timeout in background
        mocker.patch("app.users.cv.service.call_with_timeout", mocker.AsyncMock(side_effect=asyncio.TimeoutError()))
        mark_failed_spy = mocker.patch.object(repo, "mark_failed", return_value=True)

        # WHEN
        res = await service.parse_cv(user_id="u", file_bytes=b"x", filename="cv.pdf")
        assert isinstance(res, str)
        # Let the background task run
        await asyncio.sleep(0.1)

        # THEN
        assert mark_failed_spy.called
        _, kwargs = mark_failed_spy.call_args
        assert kwargs["error_code"] == CVUploadErrorCode.MARKDOWN_CONVERSION_TIMEOUT.value

    @pytest.mark.asyncio
    async def test_parse_cv_does_not_validate_markdown_immediately(self, mocker):
        # GIVEN service under test
        service = CVUploadService(repository=MockCVRepository(), cv_cloud_storage_service=MockCVCloudStorageService())
        mocker.patch("app.users.cv.service.get_application_config", mocker.Mock(return_value=type("C", (), {
            "cv_max_uploads_per_user": 999,
            "cv_rate_limit_per_minute": 999,
        })()))
        # WHEN calling parse_cv
        result = await service.parse_cv(user_id="u", file_bytes=b"x", filename="cv.pdf")
        # THEN immediate response does not raise; background task handles markdown validation
        assert isinstance(result, str) and len(result) > 0

    @pytest.mark.asyncio
    async def test_parse_cv_returns_empty_experiences_immediately(self, mocker):
        service = CVUploadService(repository=MockCVRepository(), cv_cloud_storage_service=MockCVCloudStorageService())
        mocker.patch("app.users.cv.service.get_application_config", mocker.Mock(return_value=type("C", (), {
            "cv_max_uploads_per_user": 999,
            "cv_rate_limit_per_minute": 999,
        })()))
        result = await service.parse_cv(user_id="u", file_bytes=b"x", filename="a.txt")
        assert isinstance(result, str) and len(result) > 0

    @pytest.mark.asyncio
    async def test_parse_cv_does_not_raise_on_empty_markdown_immediately(self, mocker):
        service = CVUploadService(repository=MockCVRepository(), cv_cloud_storage_service=MockCVCloudStorageService())
        mocker.patch("app.users.cv.service.get_application_config", mocker.Mock(return_value=type("C", (), {
            "cv_max_uploads_per_user": 999,
            "cv_rate_limit_per_minute": 999,
        })()))
        result = await service.parse_cv(user_id="u", file_bytes=b"x", filename="cv.pdf")
        assert isinstance(result, str)

    @pytest.mark.asyncio
    async def test_blocks_when_total_limit_reached(self, mocker):
        # GIVEN converter returns valid markdown
        mocker.patch("app.users.cv.service.convert_cv_bytes_to_markdown", mocker.Mock(return_value="# md"))
        extractor_instance = mocker.Mock()
        extractor_instance.extract_experiences = mocker.AsyncMock(return_value=["x"])
        mocker.patch("app.users.cv.service.CVExperienceExtractor", mocker.Mock(return_value=extractor_instance))

        # AND a custom repository that returns count of 3 (exceeds limit)
        class CustomRepoMock(MockCVRepository):
            async def count_uploads_for_user(self, user_id: str) -> int:
                return 3

        # AND application config with max uploads limit of 3
        service = CVUploadService(repository=CustomRepoMock(), cv_cloud_storage_service=MockCVCloudStorageService())
        mocker.patch("app.users.cv.service.get_application_config", mocker.Mock(return_value=type("C", (), {
            "cv_storage_bucket": "bucket",
            "cv_max_uploads_per_user": 3,
            "cv_rate_limit_per_minute": 10,
        })()))

        # WHEN parsing the CV
        # THEN CVLimitExceededError is raised
        with pytest.raises(CVLimitExceededError):
            await service.parse_cv(user_id="u", file_bytes=b"x", filename="cv.pdf")

    @pytest.mark.asyncio
    async def test_blocks_when_rate_limit_reached(self, mocker):
        # GIVEN converter returns valid markdown
        mocker.patch("app.users.cv.service.convert_cv_bytes_to_markdown", mocker.Mock(return_value="# md"))
        extractor_instance = mocker.Mock()
        extractor_instance.extract_experiences = mocker.AsyncMock(return_value=["x"])
        mocker.patch("app.users.cv.service.CVExperienceExtractor", mocker.Mock(return_value=extractor_instance))

        # AND a custom repository that returns rate limit count of 5 (exceeds limit)
        class CustomRepoMock(MockCVRepository):
            async def count_uploads_for_user_in_window(self, user_id: str, *, minutes: int) -> int:
                return 5

        # AND application config with rate limit of 5 per minute
        service = CVUploadService(repository=CustomRepoMock(), cv_cloud_storage_service=MockCVCloudStorageService())
        mocker.patch("app.users.cv.service.get_application_config", mocker.Mock(return_value=type("C", (), {
            "cv_storage_bucket": "bucket",
            "cv_max_uploads_per_user": 100,
            "cv_rate_limit_per_minute": 5,
        })()))

        # WHEN parsing the CV
        # THEN CVUploadRateLimitExceededError is raised
        with pytest.raises(CVUploadRateLimitExceededError):
            await service.parse_cv(user_id="u", file_bytes=b"x", filename="cv.pdf")

    @pytest.mark.asyncio
    async def test_allows_when_under_limits(self, mocker):
        # GIVEN converter returns valid markdown
        mocker.patch("app.users.cv.service.convert_cv_bytes_to_markdown", mocker.Mock(return_value="# md"))
        extractor_instance = mocker.Mock()
        extractor_instance.extract_experiences = mocker.AsyncMock(return_value=["x"])
        mocker.patch("app.users.cv.service.CVExperienceExtractor", mocker.Mock(return_value=extractor_instance))

        # AND a custom repository that returns count of 1 (under limit)
        class CustomRepoMock(MockCVRepository):
            async def count_uploads_for_user(self, user_id: str) -> int:
                return 1

        # AND application config with limits that allow the upload
        service = CVUploadService(repository=CustomRepoMock(), cv_cloud_storage_service=MockCVCloudStorageService())
        mocker.patch("app.users.cv.service.get_application_config", mocker.Mock(return_value=type("C", (), {
            "cv_storage_bucket": "bucket",
            "cv_max_uploads_per_user": 3,
            "cv_rate_limit_per_minute": 2,
        })()))

        # WHEN parsing the CV
        result = await service.parse_cv(user_id="u", file_bytes=b"x", filename="cv.pdf")

        # THEN immediate response contains empty experiences (processing is async)
        assert isinstance(result, str) and len(result) > 0

    @pytest.mark.asyncio
    async def test_raises_duplicate_cv_upload_error(self, mocker):
        # GIVEN converter returns valid markdown
        mocker.patch("app.users.cv.service.convert_cv_bytes_to_markdown", mocker.Mock(return_value="# md"))
        extractor_instance = mocker.Mock()
        extractor_instance.extract_experiences = mocker.AsyncMock(return_value=["x"])
        mocker.patch("app.users.cv.service.CVExperienceExtractor", mocker.Mock(return_value=extractor_instance))

        # AND a custom repository that raises DuplicateCVUploadError
        class CustomRepoMock(MockCVRepository):
            async def insert_upload(self, upload: UserCVUpload) -> str:
                # Simulate duplicate CV upload error
                raise DuplicateCVUploadError("duplicate_hash_123")

        # AND application config with limits that allow the upload
        service = CVUploadService(repository=CustomRepoMock(), cv_cloud_storage_service=MockCVCloudStorageService())
        mocker.patch("app.users.cv.service.get_application_config", mocker.Mock(return_value=type("C", (), {
            "cv_storage_bucket": "bucket",
            "cv_max_uploads_per_user": 3,
            "cv_rate_limit_per_minute": 2,
        })()))

        # WHEN parsing the CV
        # THEN DuplicateCVUploadError is raised
        with pytest.raises(DuplicateCVUploadError) as exc_info:
            await service.parse_cv(user_id="u", file_bytes=b"x", filename="cv.pdf")

        assert exc_info.value.md5_hash == "duplicate_hash_123"

    @pytest.mark.asyncio
    async def test_cancel_upload_success(self, mocker):
        # GIVEN a service with a mock repository
        mock_repository = MockCVRepository()
        service = CVUploadService(repository=mock_repository, cv_cloud_storage_service=MockCVCloudStorageService())

        # AND the repository returns True for successful cancellation
        mock_cancel = mocker.patch.object(mock_repository, "request_cancellation", return_value=True)

        # WHEN cancelling an upload
        result = await service.cancel_upload(user_id="user123", upload_id="upload456")

        # THEN it returns True and calls the repository
        assert result is True
        mock_cancel.assert_called_once_with("user123", "upload456")

    @pytest.mark.asyncio
    async def test_cancel_upload_not_found(self, mocker):
        # GIVEN a service with a mock repository
        mock_repository = MockCVRepository()
        service = CVUploadService(repository=mock_repository, cv_cloud_storage_service=MockCVCloudStorageService())

        # AND the repository returns False (upload not found)
        mock_cancel = mocker.patch.object(mock_repository, "request_cancellation", return_value=False)

        # WHEN cancelling an upload
        result = await service.cancel_upload(user_id="user123", upload_id="nonexistent")

        # THEN it returns False and calls the repository
        assert result is False
        mock_cancel.assert_called_once_with("user123", "nonexistent")

    @pytest.mark.asyncio
    async def test_cancel_upload_repository_exception(self, mocker):
        # GIVEN a service with a mock repository
        mock_repository = MockCVRepository()
        service = CVUploadService(repository=mock_repository, cv_cloud_storage_service=MockCVCloudStorageService())

        # AND the repository raises an exception
        mock_cancel = mocker.patch.object(mock_repository, "request_cancellation",
                                          side_effect=Exception("Database error"))

        # WHEN cancelling an upload
        result = await service.cancel_upload(user_id="user123", upload_id="upload456")

        # THEN it returns False and calls the repository
        assert result is False
        mock_cancel.assert_called_once_with("user123", "upload456")
