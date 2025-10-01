import logging
import asyncio
import pytest

from app.users.cv.constants import MAX_MARKDOWN_CHARS
from app.users.cv.service import CVUploadService
from app.users.cv.errors import MarkdownTooLongError, MarkdownConversionTimeoutError, EmptyMarkdownError, \
    CVLimitExceededError, CVUploadRateLimitExceededError
from app.users.cv.repository import IUserCVRepository
from app.users.cv.types import UserCVUpload


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
        class _Repo(IUserCVRepository):
            async def insert_upload(self, upload: UserCVUpload) -> str:
                return "id"
            async def count_uploads_for_user(self, user_id: str) -> int:
                return 0
            async def count_uploads_for_user_in_window(self, user_id: str, *, minutes: int) -> int:
                return 0

        class _Storage:
            def upload_cv(self, *, document, markdown_text: str, original_bytes: bytes):
                return None

        service = CVUploadService(repository=_Repo(), cv_cloud_storage_service=_Storage())
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
        class _Repo(IUserCVRepository):
            async def insert_upload(self, upload: UserCVUpload) -> str:
                return "id"
            async def count_uploads_for_user(self, user_id: str) -> int:
                return 0
            async def count_uploads_for_user_in_window(self, user_id: str, *, minutes: int) -> int:
                return 0

        class _Storage:
            def upload_cv(self, *, document, markdown_text: str, original_bytes: bytes):
                return None

        service = CVUploadService(repository=_Repo(), cv_cloud_storage_service=_Storage())
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
        class _Repo(IUserCVRepository):
            async def insert_upload(self, upload: UserCVUpload) -> str:
                return "id"
            async def count_uploads_for_user(self, user_id: str) -> int:
                return 0
            async def count_uploads_for_user_in_window(self, user_id: str, *, minutes: int) -> int:
                return 0

        class _Storage:
            def upload_cv(self, *, document, markdown_text: str, original_bytes: bytes):
                return None

        service = CVUploadService(repository=_Repo(), cv_cloud_storage_service=_Storage())
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
        class _Repo(IUserCVRepository):
            async def insert_upload(self, upload: UserCVUpload) -> str:
                return "id"
            async def count_uploads_for_user(self, user_id: str) -> int:
                return 0
            async def count_uploads_for_user_in_window(self, user_id: str, *, minutes: int) -> int:
                return 0

        class _Storage:
            def upload_cv(self, *, document, markdown_text: str, original_bytes: bytes):
                return None

        service = CVUploadService(repository=_Repo(), cv_cloud_storage_service=_Storage())
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
        class _Repo(IUserCVRepository):
            async def insert_upload(self, upload: UserCVUpload) -> str:
                return "id"
            async def count_uploads_for_user(self, user_id: str) -> int:
                return 0
            async def count_uploads_for_user_in_window(self, user_id: str, *, minutes: int) -> int:
                return 0

        class _Storage:
            def upload_cv(self, *, document, markdown_text: str, original_bytes: bytes):
                return None

        service = CVUploadService(repository=_Repo(), cv_cloud_storage_service=_Storage())
        # THEN the service raises MarkdownConversionTimeoutError
        with pytest.raises(MarkdownConversionTimeoutError):
            await service.parse_cv(user_id="u", file_bytes=b"x", filename="cv.pdf")

    @pytest.mark.asyncio
    async def test_blocks_when_total_limit_reached(self, mocker):
        mocker.patch("app.users.cv.service.convert_cv_bytes_to_markdown", mocker.Mock(return_value="# md"))
        extractor_instance = mocker.Mock()
        extractor_instance.extract_experiences = mocker.AsyncMock(return_value=["x"])
        mocker.patch("app.users.cv.service.CVExperienceExtractor", mocker.Mock(return_value=extractor_instance))

        class _RepoMock(IUserCVRepository):
            async def insert_upload(self, upload: UserCVUpload) -> str:
                return "id"
            async def count_uploads_for_user(self, user_id: str) -> int:
                return 3
            async def count_uploads_for_user_in_window(self, user_id: str, *, minutes: int) -> int:
                return 0

        class _Storage:
            def upload_cv(self, *, document, markdown_text: str, original_bytes: bytes):
                return None

        service = CVUploadService(repository=_RepoMock(), cv_cloud_storage_service=_Storage())
        mocker.patch("app.users.cv.service.get_application_config", mocker.Mock(return_value=type("C", (), {
            "cv_storage_bucket": "bucket",
            "cv_max_uploads_per_user": 3,
            "cv_rate_limit_per_minute": 10,
        })()))

        with pytest.raises(CVLimitExceededError):
            await service.parse_cv(user_id="u", file_bytes=b"x", filename="cv.pdf")

    @pytest.mark.asyncio
    async def test_blocks_when_rate_limit_reached(self, mocker):
        mocker.patch("app.users.cv.service.convert_cv_bytes_to_markdown", mocker.Mock(return_value="# md"))
        extractor_instance = mocker.Mock()
        extractor_instance.extract_experiences = mocker.AsyncMock(return_value=["x"])
        mocker.patch("app.users.cv.service.CVExperienceExtractor", mocker.Mock(return_value=extractor_instance))

        class _RepoMock(IUserCVRepository):
            async def insert_upload(self, upload: UserCVUpload) -> str:
                return "id"
            async def count_uploads_for_user(self, user_id: str) -> int:
                return 0
            async def count_uploads_for_user_in_window(self, user_id: str, *, minutes: int) -> int:
                return 5

        class _Storage:
            def upload_cv(self, *, document, markdown_text: str, original_bytes: bytes):
                return None

        service = CVUploadService(repository=_RepoMock(), cv_cloud_storage_service=_Storage())
        mocker.patch("app.users.cv.service.get_application_config", mocker.Mock(return_value=type("C", (), {
            "cv_storage_bucket": "bucket",
            "cv_max_uploads_per_user": 100,
            "cv_rate_limit_per_minute": 5,
        })()))

        with pytest.raises(CVUploadRateLimitExceededError):
            await service.parse_cv(user_id="u", file_bytes=b"x", filename="cv.pdf")

    @pytest.mark.asyncio
    async def test_allows_when_under_limits(self, mocker):
        mocker.patch("app.users.cv.service.convert_cv_bytes_to_markdown", mocker.Mock(return_value="# md"))
        extractor_instance = mocker.Mock()
        extractor_instance.extract_experiences = mocker.AsyncMock(return_value=["x"])
        mocker.patch("app.users.cv.service.CVExperienceExtractor", mocker.Mock(return_value=extractor_instance))

        class _RepoMock(IUserCVRepository):
            async def insert_upload(self, upload: UserCVUpload) -> str:
                return "id"
            async def count_uploads_for_user(self, user_id: str) -> int:
                return 1
            async def count_uploads_for_user_in_window(self, user_id: str, *, minutes: int) -> int:
                return 0

        class _Storage:
            def upload_cv(self, *, document, markdown_text: str, original_bytes: bytes):
                return None

        service = CVUploadService(repository=_RepoMock(), cv_cloud_storage_service=_Storage())
        mocker.patch("app.users.cv.service.get_application_config", mocker.Mock(return_value=type("C", (), {
            "cv_storage_bucket": "bucket",
            "cv_max_uploads_per_user": 3,
            "cv_rate_limit_per_minute": 2,
        })()))

        result = await service.parse_cv(user_id="u", file_bytes=b"x", filename="cv.pdf")
        assert result.experiences_data == ["x"]
