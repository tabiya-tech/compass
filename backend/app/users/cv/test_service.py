import logging
import pytest

from app.users.cv.service import CVUploadService
from app.users.cv.errors import MarkdownTooLongError


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

        # WHEN parsing
        service = CVUploadService()
        result = await service.parse_cv(
            user_id="user-1",
            file_bytes=given_bytes,
            filename=given_filename,
            content_type="application/pdf",
        )

        # THEN returns the extracted items
        assert result.experiences_data == extracted_items

        # AND converter was called once with a logger
        assert convert_mock.call_count == 1
        _, kwargs = convert_mock.call_args
        # convert_cv_bytes_to_markdown is called positionally; validate third arg exists and is a logger
        args = convert_mock.call_args[0]
        assert isinstance(args[2], logging.Logger)

        # AND the extractor class was instantiated with a logger
        extractor_cls.assert_called_once()
        extractor_init_kwargs = extractor_cls.call_args.kwargs
        assert isinstance(extractor_init_kwargs.get("logger"), logging.Logger)

        # AND the extractor was called with the markdown from the converter
        extractor_instance.extract_experiences.assert_awaited_once_with("# Markdown CV")

    @pytest.mark.asyncio
    async def test_parse_cv_propagates_markdown_too_long_error(self, mocker):
        # GIVEN a converter that raises MarkdownTooLongError
        error = MarkdownTooLongError(6000, 5000)
        convert_mock = mocker.Mock(side_effect=error)
        mocker.patch("app.users.cv.service.convert_cv_bytes_to_markdown", convert_mock)

        # AND an extractor patched (should not be called)
        extractor_cls = mocker.Mock()
        mocker.patch("app.users.cv.service.CVExperienceExtractor", extractor_cls)

        # WHEN/THEN parsing raises the same error
        service = CVUploadService()
        with pytest.raises(MarkdownTooLongError) as err:
            await service.parse_cv(
                user_id="user-1",
                file_bytes=b"...",
                filename="cv.pdf",
                content_type="application/pdf",
            )
        assert err.value is error
        extractor_cls.assert_not_called()

    @pytest.mark.asyncio
    async def test_parse_cv_handles_empty_extractor_output(self, mocker):
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

        # WHEN
        service = CVUploadService()
        result = await service.parse_cv(
            user_id="u",
            file_bytes=b"x",
            filename="a.txt",
            content_type="text/plain",
        )

        # THEN
        assert result.experiences_data == []

