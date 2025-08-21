import pytest

from app.users.cv.utils.markdown_converter import convert_cv_bytes_to_markdown
from app.users.cv.errors import MarkdownTooLongError
from app.users.cv.constants import MAX_MARKDOWN_CHARS


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

    def test_raises_when_markdown_exceeds_limit(self, mocker):
        # GIVEN a file that converts to a markdown longer than the limit
        given_bytes = b"dummy"
        given_filename = "cv.txt"
        too_long_text = "A" * (MAX_MARKDOWN_CHARS + 1)

        fake_result = mocker.Mock(markdown=too_long_text)
        fake_converter = mocker.Mock(convert_stream=mocker.Mock(return_value=fake_result))
        mocker.patch("app.users.cv.utils.markdown_converter.MarkItDown", return_value=fake_converter)

        # WHEN/THEN converting raises MarkdownTooLongError
        with pytest.raises(MarkdownTooLongError) as err:
            convert_cv_bytes_to_markdown(given_bytes, given_filename, mocker.Mock())

        assert err.value.length == MAX_MARKDOWN_CHARS + 1
        assert err.value.limit == MAX_MARKDOWN_CHARS


