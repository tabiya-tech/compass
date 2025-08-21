"""
Tests for the CV upload service
"""
import pytest
import pytest_mock

from app.users.cv.service import CVUploadService
from common_libs.test_utilities import get_random_user_id


@pytest.fixture(scope='function')
def _cv_upload_service() -> CVUploadService:
    class _Service(CVUploadService):
        pass

    return _Service()


class TestParseCV:
    @pytest.mark.asyncio
    async def test_parse_cv_returns_markdown(self, _cv_upload_service: CVUploadService, mocker: pytest_mock.MockerFixture):
        # GIVEN user id, filename and file bytes
        given_user_id = get_random_user_id()
        given_filename = "cv.docx"
        given_file_bytes = b"dummy-content"

        # AND the markdown converter returns some markdown
        expected_markdown = "# Title\nSome content"
        _convert_spy = mocker.patch(
            "app.users.cv.service.convert_cv_bytes_to_markdown",
            return_value=expected_markdown
        )

        # WHEN parsing the CV
        actual_parsed = await _cv_upload_service.parse_cv(
            user_id=given_user_id,
            file_bytes=given_file_bytes,
            filename=given_filename,
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

        # THEN the service returns the markdown in experiences_data
        assert actual_parsed.experiences_data == expected_markdown

        # AND the converter was invoked with the given bytes and filename
        _convert_spy.assert_called_once_with(given_file_bytes, given_filename)

    @pytest.mark.asyncio
    async def test_parse_cv_propagates_error(self, _cv_upload_service: CVUploadService, mocker: pytest_mock.MockerFixture):
        # GIVEN a converter that raises an error
        given_user_id = get_random_user_id()
        given_filename = "cv.pdf"
        given_file_bytes = b"%PDF-1.4..."
        given_error = Exception("conversion failed")
        mocker.patch(
            "app.users.cv.service.convert_cv_bytes_to_markdown",
            side_effect=given_error
        )

        # WHEN parsing the CV
        with pytest.raises(Exception) as error_info:
            await _cv_upload_service.parse_cv(
                user_id=given_user_id,
                file_bytes=given_file_bytes,
                filename=given_filename,
                content_type="application/pdf",
            )

        # THEN the same error is raised
        assert error_info.value == given_error


