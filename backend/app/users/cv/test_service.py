import logging
import asyncio
import pytest

from app.users.cv.constants import MAX_MARKDOWN_CHARS
from app.users.cv.service import CVUploadService
from app.users.cv.errors import MarkdownTooLongError, MarkdownConversionTimeoutError, EmptyMarkdownError, \
    CVLimitExceededError, CVUploadRateLimitExceededError, DuplicateCVUploadError
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


class MockCVCloudStorageService(ICVCloudStorageService):
    """Mock storage service for testing."""
    def upload_cv(self, *, document: UserCVUpload, markdown_text: str, original_bytes: bytes) -> None: # Noncompliant - we keep this method empty cause its a mock for a test
        pass


class TestCVUploadService:
    @pytest.mark.asyncio
    async def test_parse_cv_success_passes_logger_and_returns_items(self, mocker):
        # GIVEN input bytes and filename
        given_bytes = b"%PDF-1.4 ..."
        given_filename = "resume.pdf"

        # AND a converter that returns markdown and captures the logger param
        def _fake_convert(file_bytes, filename, logger):
            assert file_bytes == given_bytes
            assert filename == given_filename
            assert isinstance(logger, logging.Logger)
            return "# Markdown CV"

        convert_mock = mocker.Mock(side_effect=_fake_convert)
        mocker.patch("app.users.cv.service.convert_cv_bytes_to_markdown", convert_mock)

        # AND an extractor class whose instance returns expected items
        extracted_items = [
            "I worked as a developer at Foo Corp from 2020 to 2022.",
            "I volunteered as a mentor in 2019.",
        ]
        extractor_instance = mocker.Mock()
        extractor_instance.extract_experiences = mocker.AsyncMock(return_value=extracted_items)
        extractor_cls = mocker.Mock(return_value=extractor_instance)
        mocker.patch("app.users.cv.service.CVExperienceExtractor", extractor_cls)

        # WHEN parsing the CV in the service
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

        # THEN the service returns the extracted items
        assert result.experiences_data == extracted_items

        # AND converter was called once with a logger
        assert convert_mock.call_count == 1
        _, _ = convert_mock.call_args
        # convert_cv_bytes_to_markdown is called positionally; validate third arg exists and is a logger
        args = convert_mock.call_args[0]
        assert isinstance(args[2], logging.Logger)

        # AND the extractor class was instantiated with a logger (positional arg)
        extractor_cls.assert_called_once()
        extractor_init_args = extractor_cls.call_args.args
        assert len(extractor_init_args) >= 1 and isinstance(extractor_init_args[0], logging.Logger)

        # AND the extractor was called with the markdown from the converter
        extractor_instance.extract_experiences.assert_awaited_once_with("# Markdown CV")

    @pytest.mark.asyncio
    async def test_parse_cv_raises_when_markdown_exceeds_limit(self, mocker):
        # GIVEN the converter returns markdown longer than the configured limit
        too_long_text = "A" * (MAX_MARKDOWN_CHARS + 1)
        convert_mock = mocker.Mock(return_value=too_long_text)
        mocker.patch("app.users.cv.service.convert_cv_bytes_to_markdown", convert_mock)

        # AND an extractor patched (should not be called)
        extractor_instance = mocker.Mock()
        extractor_instance.extract_experiences = mocker.AsyncMock()
        extractor_cls = mocker.Mock(return_value=extractor_instance)
        mocker.patch("app.users.cv.service.CVExperienceExtractor", extractor_cls)

        # WHEN parsing the CV
        service = CVUploadService(repository=MockCVRepository(), cv_cloud_storage_service=MockCVCloudStorageService())
        
        # THEN a MarkdownTooLongError is raised and the extractor is not invoked to extract
        with pytest.raises(MarkdownTooLongError):
            await service.parse_cv(user_id="u", file_bytes=b"x", filename="cv.pdf")
        extractor_instance.extract_experiences.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_parse_cv_returns_empty_when_extractor_returns_empty(self, mocker):
        # GIVEN converter returns markdown
        mocker.patch(
            "app.users.cv.service.convert_cv_bytes_to_markdown",
            mocker.Mock(return_value="MD")
        )

        # AND extractor returns empty list
        extractor_instance = mocker.Mock()
        extractor_instance.extract_experiences = mocker.AsyncMock(return_value=[])
        extractor_cls = mocker.Mock(return_value=extractor_instance)
        mocker.patch("app.users.cv.service.CVExperienceExtractor", extractor_cls)

        # WHEN parsing the CV
        service = CVUploadService(repository=MockCVRepository(), cv_cloud_storage_service=MockCVCloudStorageService())
        mocker.patch("app.users.cv.service.get_application_config", mocker.Mock(return_value=type("C", (), {
            "cv_max_uploads_per_user": 999,
            "cv_rate_limit_per_minute": 999,
        })()))
        result = await service.parse_cv(
            user_id="u",
            file_bytes=b"x",
            filename="a.txt",
        )

        # THEN the service returns an empty list of experiences
        assert result.experiences_data == []

    @pytest.mark.asyncio
    async def test_parse_cv_raises_on_empty_markdown(self, mocker):
        # GIVEN converter returns empty markdown
        mocker.patch(
            "app.users.cv.service.convert_cv_bytes_to_markdown",
            mocker.Mock(return_value="   ")
        )

        # AND extractor should not be called
        extractor_instance = mocker.Mock()
        extractor_instance.extract_experiences = mocker.AsyncMock()
        extractor_cls = mocker.Mock(return_value=extractor_instance)
        mocker.patch("app.users.cv.service.CVExperienceExtractor", extractor_cls)

        # WHEN parsing the CV
        service = CVUploadService(repository=MockCVRepository(), cv_cloud_storage_service=MockCVCloudStorageService())
        
        # THEN EmptyMarkdownError is raised and the extractor is not invoked to extract
        with pytest.raises(EmptyMarkdownError):
            await service.parse_cv(user_id="u", file_bytes=b"x", filename="cv.pdf")
        extractor_instance.extract_experiences.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_parse_cv_times_out_and_maps_error(self, mocker):
        # GIVEN the timeout wrapper raises asyncio.TimeoutError
        mocker.patch(
            "app.users.cv.service.call_with_timeout",
            mocker.AsyncMock(side_effect=asyncio.TimeoutError())
        )

        # WHEN parsing the CV
        service = CVUploadService(repository=MockCVRepository(), cv_cloud_storage_service=MockCVCloudStorageService())
        
        # THEN the service raises MarkdownConversionTimeoutError
        with pytest.raises(MarkdownConversionTimeoutError):
            await service.parse_cv(user_id="u", file_bytes=b"x", filename="cv.pdf")

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
        
        # THEN the service returns the extracted experiences
        assert result.experiences_data == ["x"]

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
