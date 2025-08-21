from io import BytesIO

import pytest


class TestConvertCVBytesToMarkdown:
    @pytest.mark.asyncio
    async def test_converts_bytes_via_markitdown(self, mocker):
        # GIVEN raw bytes and a filename
        given_bytes = b"dummy-cv-content"
        given_filename = "cv.docx"

        # AND a mocked MarkItDown converter returning a result object
        mocked_result = mocker.Mock(markdown="# Hello\nWorld", text_content="Hello\nWorld")

        mocked_converter_instance = mocker.Mock()
        mocked_converter_instance.convert_stream.return_value = mocked_result

        mocked_markitdown_cls = mocker.patch(
            "app.users.cv.utils.markdown_converter.MarkItDown",
            return_value=mocked_converter_instance
        )

        # WHEN converting the bytes to markdown
        from app.users.cv.utils.markdown_converter import convert_cv_bytes_to_markdown
        actual_markdown = convert_cv_bytes_to_markdown(given_bytes, given_filename)

        # THEN MarkItDown is constructed and used with a stream and filename
        mocked_markitdown_cls.assert_called_once()
        mocked_converter_instance.convert_stream.assert_called_once()
        args, kwargs = mocked_converter_instance.convert_stream.call_args
        assert isinstance(args[0], BytesIO)
        assert kwargs["filename"] == given_filename

        # AND the markdown is returned preferring the `markdown` attribute
        assert actual_markdown == "# Hello\nWorld"

    @pytest.mark.asyncio
    async def test_falls_back_to_text_content(self, mocker):
        # GIVEN raw bytes and a filename
        given_bytes = b"dummy"
        given_filename = "cv.pdf"

        # AND a result with no markdown attribute
        mocked_result = mocker.Mock(markdown=None, text_content="plain text")
        mocked_converter_instance = mocker.Mock(convert_stream=mocker.Mock(return_value=mocked_result))
        mocker.patch(
            "app.users.cv.utils.markdown_converter.MarkItDown",
            return_value=mocked_converter_instance
        )

        # WHEN converting
        from app.users.cv.utils.markdown_converter import convert_cv_bytes_to_markdown
        actual_markdown = convert_cv_bytes_to_markdown(given_bytes, given_filename)

        # THEN it falls back to text_content
        assert actual_markdown == "plain text"


