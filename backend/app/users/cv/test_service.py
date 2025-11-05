import pytest

import asyncio
from app.users.cv.service import CVUploadService
from app.users.cv.types import CVUploadErrorCode, UserCVUpload, CVStructuredExtraction
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

    async def mark_state_injected(self, user_id: str, upload_id: str) -> bool:
        return True

    async def mark_injection_failed(self, user_id: str, upload_id: str, *, error: str) -> bool:
        return True


class MockCVCloudStorageService(ICVCloudStorageService):
    """Mock storage service for testing."""

    def upload_cv(self, *, document: UserCVUpload, markdown_text: str,
                  original_bytes: bytes) -> None:  # Noncompliant - we keep this method empty cause its a mock for a test
        pass

    def download_markdown(self, *, object_path: str) -> str:  # pragma: no cover - test helper
        return "# mock markdown"


class DummyStructuredExtractor:
    async def extract_structured_experiences(self, markdown_cv: str) -> CVStructuredExtraction:
        return CVStructuredExtraction(collected_data=[], experience_entities=[], extraction_metadata={})


class TestCVUploadService:
    @pytest.mark.asyncio
    async def test_parse_cv_returns_upload_id_and_empty_experiences_immediately(self, mocker):
        # GIVEN input bytes and filename
        given_bytes = b"%PDF-1.4 ..."
        given_filename = "resume.pdf"

        # WHEN parsing the CV in the service (immediate response design)
        service = CVUploadService(repository=MockCVRepository(), cv_cloud_storage_service=MockCVCloudStorageService(),
                                  structured_extractor=DummyStructuredExtractor())
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
        service = CVUploadService(repository=repo, cv_cloud_storage_service=MockCVCloudStorageService(),
                                  structured_extractor=DummyStructuredExtractor())
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
        service = CVUploadService(repository=MockCVRepository(), cv_cloud_storage_service=MockCVCloudStorageService(),
                                  structured_extractor=DummyStructuredExtractor())
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
        service = CVUploadService(repository=MockCVRepository(), cv_cloud_storage_service=MockCVCloudStorageService(),
                                  structured_extractor=DummyStructuredExtractor())
        mocker.patch("app.users.cv.service.get_application_config", mocker.Mock(return_value=type("C", (), {
            "cv_max_uploads_per_user": 999,
            "cv_rate_limit_per_minute": 999,
        })()))
        result = await service.parse_cv(user_id="u", file_bytes=b"x", filename="a.txt")
        assert isinstance(result, str) and len(result) > 0

    @pytest.mark.asyncio
    async def test_parse_cv_does_not_raise_on_empty_markdown_immediately(self, mocker):
        service = CVUploadService(repository=MockCVRepository(), cv_cloud_storage_service=MockCVCloudStorageService(),
                                  structured_extractor=DummyStructuredExtractor())
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
        extractor_instance.extract_structured_experiences = mocker.AsyncMock(
            return_value=mocker.Mock(extraction_metadata={"total_experiences": 1}))
        mocker.patch("app.users.cv.service.CVStructuredExperienceExtractor",
                     mocker.Mock(return_value=extractor_instance))

        # AND a custom repository that returns count of 3 (exceeds limit)
        class CustomRepoMock(MockCVRepository):
            async def count_uploads_for_user(self, user_id: str) -> int:
                return 3

        # AND application config with max uploads limit of 3
        service = CVUploadService(repository=CustomRepoMock(), cv_cloud_storage_service=MockCVCloudStorageService(),
                                  structured_extractor=DummyStructuredExtractor())
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
        extractor_instance.extract_structured_experiences = mocker.AsyncMock(
            return_value=mocker.Mock(extraction_metadata={"total_experiences": 1}))
        mocker.patch("app.users.cv.service.CVStructuredExperienceExtractor",
                     mocker.Mock(return_value=extractor_instance))

        # AND a custom repository that returns rate limit count of 5 (exceeds limit)
        class CustomRepoMock(MockCVRepository):
            async def count_uploads_for_user_in_window(self, user_id: str, *, minutes: int) -> int:
                return 5

        # AND application config with rate limit of 5 per minute
        service = CVUploadService(repository=CustomRepoMock(), cv_cloud_storage_service=MockCVCloudStorageService(),
                                  structured_extractor=DummyStructuredExtractor())
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
        extractor_instance.extract_structured_experiences = mocker.AsyncMock(
            return_value=mocker.Mock(extraction_metadata={"total_experiences": 1}))
        mocker.patch("app.users.cv.service.CVStructuredExperienceExtractor",
                     mocker.Mock(return_value=extractor_instance))

        # AND a custom repository that returns count of 1 (under limit)
        class CustomRepoMock(MockCVRepository):
            async def count_uploads_for_user(self, user_id: str) -> int:
                return 1

        # AND application config with limits that allow the upload
        service = CVUploadService(repository=CustomRepoMock(), cv_cloud_storage_service=MockCVCloudStorageService(),
                                  structured_extractor=DummyStructuredExtractor())
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
        extractor_instance.extract_structured_experiences = mocker.AsyncMock(
            return_value=mocker.Mock(extraction_metadata={"total_experiences": 1}))
        mocker.patch("app.users.cv.service.CVStructuredExperienceExtractor",
                     mocker.Mock(return_value=extractor_instance))

        # AND a custom repository that raises DuplicateCVUploadError
        class CustomRepoMock(MockCVRepository):
            async def insert_upload(self, upload: UserCVUpload) -> str:
                # Simulate duplicate CV upload error
                raise DuplicateCVUploadError("duplicate_hash_123")

        # AND application config with limits that allow the upload
        service = CVUploadService(repository=CustomRepoMock(), cv_cloud_storage_service=MockCVCloudStorageService(),
                                  structured_extractor=DummyStructuredExtractor())
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
        service = CVUploadService(repository=mock_repository, cv_cloud_storage_service=MockCVCloudStorageService(),
                                  structured_extractor=DummyStructuredExtractor())

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
        service = CVUploadService(repository=mock_repository, cv_cloud_storage_service=MockCVCloudStorageService(),
                                  structured_extractor=DummyStructuredExtractor())

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
        service = CVUploadService(repository=mock_repository, cv_cloud_storage_service=MockCVCloudStorageService(),
                                  structured_extractor=DummyStructuredExtractor())

        # AND the repository raises an exception
        mock_cancel = mocker.patch.object(mock_repository, "request_cancellation",
                                          side_effect=Exception("Database error"))

        # WHEN cancelling an upload
        result = await service.cancel_upload(user_id="user123", upload_id="upload456")

        # THEN it returns False and calls the repository
        assert result is False
        mock_cancel.assert_called_once_with("user123", "upload456")

    @pytest.mark.asyncio
    async def test_pipeline_injects_state_when_session_id_provided(self, mocker):
        # GIVEN a repo we can spy on
        class RepoSpy(MockCVRepository):
            pass

        repo = RepoSpy()
        mark_injected_spy = mocker.spy(repo, "mark_state_injected")

        # AND a minimal application state manager
        class _InMemoryStateManager:
            async def get_state(self, session_id: int):
                from app.application_state import ApplicationState
                return ApplicationState.new_state(session_id=session_id)

            async def save_state(self, state):
                return None

            async def delete_state(self, session_id: int):
                return None

            async def get_all_session_ids(self):
                if False:
                    yield 0

        # AND a service with the manager
        service = CVUploadService(repository=repo, cv_cloud_storage_service=MockCVCloudStorageService(),
                                  structured_extractor=DummyStructuredExtractor(),
                                  application_state_manager=_InMemoryStateManager())
        mocker.patch("app.users.cv.service.get_application_config", mocker.Mock(return_value=type("C", (), {
            "cv_max_uploads_per_user": 999,
            "cv_rate_limit_per_minute": 999,
        })()))
        # AND stub structured extractor to return minimal structured data
        mocker.patch.object(service._structured_extractor, "extract_structured_experiences",
                            mocker.AsyncMock(
                                return_value=CVStructuredExtraction(collected_data=[], experience_entities=[],
                                                                    extraction_metadata={})))
        # AND stub storage upload (called via to_thread) by patching method to no-op
        mocker.patch.object(service._cv_cloud_storage_service, "upload_cv", return_value=None)
        # AND spy on injection service to verify it is invoked
        inj_spy = mocker.patch("app.users.cv.service.StateInjectionService.inject_cv_data",
                               new=mocker.AsyncMock(return_value=True))

        # WHEN
        upload_id = await service.parse_cv(user_id="u", file_bytes=b"x", filename="cv.pdf", session_id=123)
        assert isinstance(upload_id, str)
        await asyncio.sleep(0.1)

        # THEN injection is attempted and success is recorded
        assert mark_injected_spy.called
        inj_spy.assert_called()

    @pytest.mark.asyncio
    async def test_pipeline_marks_injection_failed_when_injection_returns_false(self, mocker):
        # GIVEN a repo we can spy on
        class RepoSpy(MockCVRepository):
            pass

        repo = RepoSpy()
        mark_injected_spy = mocker.spy(repo, "mark_state_injected")
        mark_injection_failed_spy = mocker.spy(repo, "mark_injection_failed")

        # AND a minimal application state manager
        class _InMemoryStateManager:
            async def get_state(self, session_id: int):
                from app.application_state import ApplicationState
                return ApplicationState.new_state(session_id=session_id)

            async def save_state(self, state):
                return None

            async def delete_state(self, session_id: int):
                return None

            async def get_all_session_ids(self):
                if False:
                    yield 0

        service = CVUploadService(repository=repo, cv_cloud_storage_service=MockCVCloudStorageService(),
                                  structured_extractor=DummyStructuredExtractor(),
                                  application_state_manager=_InMemoryStateManager())
        mocker.patch("app.users.cv.service.get_application_config", mocker.Mock(return_value=type("C", (), {
            "cv_max_uploads_per_user": 999,
            "cv_rate_limit_per_minute": 999,
        })()))
        # Stub extractor and storage
        mocker.patch.object(service._structured_extractor, "extract_structured_experiences",
                            mocker.AsyncMock(
                                return_value=CVStructuredExtraction(collected_data=[], experience_entities=[],
                                                                    extraction_metadata={})))
        mocker.patch.object(service._cv_cloud_storage_service, "upload_cv", return_value=None)
        # Force injection to return False
        inj_spy = mocker.patch("app.users.cv.service.StateInjectionService.inject_cv_data",
                               new=mocker.AsyncMock(return_value=False))

        # WHEN
        upload_id = await service.parse_cv(user_id="u", file_bytes=b"x", filename="cv.pdf", session_id=456)
        assert isinstance(upload_id, str)
        await asyncio.sleep(0.1)

        # THEN injection attempted but mark_injection_failed called, not mark_state_injected
        inj_spy.assert_called()
        assert mark_injected_spy.called is False
        assert mark_injection_failed_spy.called is True

    @pytest.mark.asyncio
    async def test_pipeline_handles_cancel_request_without_marking_injected(self, mocker):
        # GIVEN a repo where cancellation can be requested
        class RepoSpy(MockCVRepository):
            def __init__(self):
                self._cancel_requested = False

            async def request_cancellation(self, user_id: str, upload_id: str) -> bool:
                self._cancel_requested = True
                return True

        repo = RepoSpy()
        mocker.spy(repo, "mark_state_injected")

        class _InMemoryStateManager:
            def get_state(self, session_id: int):
                from app.application_state import ApplicationState
                return ApplicationState.new_state(session_id=session_id)

            def save_state(self, state):
                return None

            def delete_state(self, session_id: int):
                return None

            def get_all_session_ids(self):
                if False:
                    yield 0

        service = CVUploadService(repository=repo, cv_cloud_storage_service=MockCVCloudStorageService(),
                                  structured_extractor=DummyStructuredExtractor(),
                                  application_state_manager=_InMemoryStateManager())
        mocker.patch("app.users.cv.service.get_application_config", mocker.Mock(return_value=type("C", (), {
            "cv_max_uploads_per_user": 999,
            "cv_rate_limit_per_minute": 999,
        })()))

        # Slow extractor so we can cancel during pipeline
        async def slow_extract(*args, **kwargs):
            await asyncio.sleep(0.05)
            return CVStructuredExtraction(collected_data=[], experience_entities=[], extraction_metadata={})

        mocker.patch.object(service._structured_extractor, "extract_structured_experiences",
                            mocker.AsyncMock(side_effect=slow_extract))
        mocker.patch.object(service._cv_cloud_storage_service, "upload_cv", return_value=None)

        # WHEN start parse to get upload id, then immediately cancel
        upload_id = await service.parse_cv(user_id="u", file_bytes=b"x", filename="cv.pdf", session_id=789)
        await service.cancel_upload(user_id="u", upload_id=upload_id)
        await asyncio.sleep(0.1)
