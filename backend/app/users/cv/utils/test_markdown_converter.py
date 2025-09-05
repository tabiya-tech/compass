import pytest

from app.users.cv.utils.markdown_converter import convert_cv_bytes_to_markdown


class TestMarkdownConverter:
    def test_returns_markdown_when_within_limit(self, mocker):
        # GIVEN a small file that converts to a short markdown string
        given_bytes = b"dummy"
        given_filename = "cv.txt"

        # Patch MarkItDown to return a fake result object with markdown
        fake_result = mocker.Mock(markdown="# Hello")
        fake_converter = mocker.Mock(convert_stream=mocker.Mock(return_value=fake_result))
        mocker.patch("app.users.cv.utils.markdown_converter.MarkItDown", return_value=fake_converter)

        # WHEN converting
        actual = convert_cv_bytes_to_markdown(given_bytes, given_filename, mocker.Mock())

        # THEN the short markdown is returned
        assert actual == "# Hello"

    # Length/emptiness are business rules validated in the service; no length checks here anymore


