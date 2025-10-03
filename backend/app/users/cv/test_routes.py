from http import HTTPStatus

import pytest
import pytest_mock
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient

from app.users.auth import UserInfo
from app.users.cv.routes import (
    add_user_cv_routes,
    get_cv_service,
    ALLOWED_MIME_TYPES,
    ALLOWED_EXTENSIONS,
    MAX_CV_SIZE_BYTES,
)
from app.users.cv.service import ICVUploadService, ParsedCV
from app.users.cv.errors import MarkdownTooLongError, MarkdownConversionTimeoutError, EmptyMarkdownError, \
    CVLimitExceededError, CVUploadRateLimitExceededError, DuplicateCVUploadError
from common_libs.test_utilities.mock_auth import MockAuth


TestClientWithMocks = tuple[TestClient, ICVUploadService, UserInfo]


@pytest.fixture(scope='function')
def client_with_mocks() -> TestClientWithMocks:
    class MockCVService(ICVUploadService):
        async def parse_cv(self, *, user_id: str, file_bytes: bytes, filename: str) -> ParsedCV:
            return ParsedCV(experiences_data=["parsed"])

    _instance_cv_service = MockCVService()

    def _mocked_get_cv_service() -> ICVUploadService:
        return _instance_cv_service

    _instance_auth = MockAuth()

    api_router = APIRouter()
    app = FastAPI()
    app.dependency_overrides[get_cv_service] = _mocked_get_cv_service

    add_user_cv_routes(api_router, auth=_instance_auth)
    app.include_router(api_router)

    yield TestClient(app), _instance_cv_service, _instance_auth.mocked_user
    app.dependency_overrides = {}


class TestUploadCV:
    @pytest.mark.asyncio
    @pytest.mark.parametrize("mime", tuple(ALLOWED_MIME_TYPES))
    async def test_success_allowed_mime_type(self, client_with_mocks: TestClientWithMocks, mime: str):
        client, _, mocked_user = client_with_mocks
        # GIVEN a valid file with an allowed MIME type and allowed extension
        given_user_id = mocked_user.user_id
        given_mime = mime
        given_ext = next(iter(ALLOWED_EXTENSIONS))
        given_file_content = b"hello"
        headers = {"Content-Type": given_mime, "x-filename": f"cv{given_ext}"}
        expected_response = {"experiences_data": ["parsed"]}

        # WHEN uploading the CV via raw streaming body
        response = client.post(f"/{given_user_id}/cv", data=given_file_content, headers=headers)

        # THEN the request succeeds
        assert response.status_code == HTTPStatus.OK
        assert response.json() == expected_response

    @pytest.mark.asyncio
    @pytest.mark.parametrize("ext", tuple(ALLOWED_EXTENSIONS))
    async def test_success_allowed_extension(self, client_with_mocks: TestClientWithMocks, ext: str):
        client, _, mocked_user = client_with_mocks
        # GIVEN a valid file with an allowed extension and allowed MIME type
        given_user_id = mocked_user.user_id
        given_ext = ext
        given_mime = next(iter(ALLOWED_MIME_TYPES))
        given_file_content = b"hello"
        headers = {"Content-Type": given_mime, "x-filename": f"cv{given_ext}"}
        expected_response = {"experiences_data": ["parsed"]}

        # WHEN uploading the CV via raw streaming body
        response = client.post(f"/{given_user_id}/cv", data=given_file_content, headers=headers)

        # THEN the request succeeds
        assert response.status_code == HTTPStatus.OK
        assert response.json() == expected_response

    @pytest.mark.asyncio
    async def test_forbidden_other_user(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_user = client_with_mocks
        parse_spy = mocker.spy(mocked_service, "parse_cv")
        # GIVEN a different user id and a valid file
        given_other_user_id = mocked_user.user_id + "_x"
        given_mime = next(iter(ALLOWED_MIME_TYPES))
        given_ext = next(iter(ALLOWED_EXTENSIONS))
        given_file_content = b"hello"
        headers = {"Content-Type": given_mime, "x-filename": f"cv{given_ext}"}

        # WHEN uploading the CV for another user
        response = client.post(f"/{given_other_user_id}/cv", files={"file": ("cv" + given_ext, given_file_content, given_mime)}, headers=headers)

        # THEN the request is forbidden and the service is not called
        assert response.status_code == HTTPStatus.FORBIDDEN
        parse_spy.assert_not_called()

    @pytest.mark.asyncio
    async def test_unsupported_media_type_by_extension(self, client_with_mocks: TestClientWithMocks):
        client, _, mocked_user = client_with_mocks
        # GIVEN a file with an invalid extension and valid mime
        invalid_ext_candidates = [
            ".doc",
            ".rtf",
            ".png",
        ]
        given_invalid_ext = next((e for e in invalid_ext_candidates if e not in ALLOWED_EXTENSIONS), None)
        assert given_invalid_ext is not None
        given_mime = next(iter(ALLOWED_MIME_TYPES))
        given_file_content = b"hello"
        headers = {"Content-Type": given_mime, "x-filename": f"cv{given_invalid_ext}"}

        # WHEN uploading the CV
        response = client.post(f"/{mocked_user.user_id}/cv", data=given_file_content, headers=headers)

        # THEN the request is unsupported media type
        assert response.status_code == HTTPStatus.UNSUPPORTED_MEDIA_TYPE

    @pytest.mark.asyncio
    async def test_payload_too_large(self, client_with_mocks: TestClientWithMocks):
        client, _, mocked_user = client_with_mocks
        # GIVEN an oversized file that exceeds the limit
        given_oversized_content = b"0" * (MAX_CV_SIZE_BYTES + 1)
        given_mime = next(iter(ALLOWED_MIME_TYPES))
        given_ext = next(iter(ALLOWED_EXTENSIONS))
        headers = {"Content-Type": given_mime, "x-filename": f"cv{given_ext}"}

        # WHEN uploading the CV
        response = client.post(f"/{mocked_user.user_id}/cv", data=given_oversized_content, headers=headers)

        # THEN the request is rejected with 413
        assert response.status_code == HTTPStatus.REQUEST_ENTITY_TOO_LARGE

    @pytest.mark.asyncio
    async def test_internal_error(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_user = client_with_mocks
        # GIVEN a valid file but the service raises an exception
        mocker.patch.object(mocked_service, "parse_cv", side_effect=Exception("boom"))
        given_mime = next(iter(ALLOWED_MIME_TYPES))
        given_ext = next(iter(ALLOWED_EXTENSIONS))
        given_file_content = b"hello"
        headers = {"Content-Type": given_mime, "x-filename": f"cv{given_ext}"}

        # WHEN uploading the CV
        response = client.post(f"/{mocked_user.user_id}/cv", data=given_file_content, headers=headers)

        # THEN the request results in an internal server error
        assert response.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

    @pytest.mark.asyncio
    async def test_service_markdown_too_long_maps_to_413(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_user = client_with_mocks
        # GIVEN service raises MarkdownTooLongError after conversion
        mocker.patch.object(mocked_service, "parse_cv", side_effect=MarkdownTooLongError(6000, 5000))
        given_mime = next(iter(ALLOWED_MIME_TYPES))
        given_ext = next(iter(ALLOWED_EXTENSIONS))
        headers = {"Content-Type": given_mime, "x-filename": f"cv{given_ext}"}
        # WHEN uploading the CV
        response = client.post(f"/{mocked_user.user_id}/cv", data=b"hello", headers=headers)
        # THEN it maps to 413
        assert response.status_code == HTTPStatus.REQUEST_ENTITY_TOO_LARGE

    @pytest.mark.asyncio
    async def test_service_timeout_maps_to_408(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_user = client_with_mocks
        # GIVEN service raises MarkdownConversionTimeoutError
        mocker.patch.object(mocked_service, "parse_cv", side_effect=MarkdownConversionTimeoutError(60))
        given_mime = next(iter(ALLOWED_MIME_TYPES))
        given_ext = next(iter(ALLOWED_EXTENSIONS))
        headers = {"Content-Type": given_mime, "x-filename": f"cv{given_ext}"}
        # WHEN uploading the CV
        response = client.post(f"/{mocked_user.user_id}/cv", data=b"hello", headers=headers)
        # THEN it maps to 408
        assert response.status_code == HTTPStatus.REQUEST_TIMEOUT

    @pytest.mark.asyncio
    async def test_service_empty_markdown_maps_to_422(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_user = client_with_mocks
        # GIVEN service raises EmptyMarkdownError
        mocker.patch.object(mocked_service, "parse_cv", side_effect=EmptyMarkdownError("cv.pdf"))
        given_mime = next(iter(ALLOWED_MIME_TYPES))
        given_ext = next(iter(ALLOWED_EXTENSIONS))
        headers = {"Content-Type": given_mime, "x-filename": f"cv{given_ext}"}
        # WHEN uploading the CV
        response = client.post(f"/{mocked_user.user_id}/cv", data=b"hello", headers=headers)
        # THEN it maps to 422
        assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY

    @pytest.mark.asyncio
    async def test_service_max_uploads_maps_to_403(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_user = client_with_mocks
        # GIVEN service raises CVLimitExceededError when user exceeds uploads
        mocker.patch.object(mocked_service, "parse_cv", side_effect=CVLimitExceededError("Maximum number of CV uploads reached"))
        given_mime = next(iter(ALLOWED_MIME_TYPES))
        given_ext = next(iter(ALLOWED_EXTENSIONS))
        headers = {"Content-Type": given_mime, "x-filename": f"cv{given_ext}"}
        # WHEN uploading the CV
        response = client.post(f"/{mocked_user.user_id}/cv", data=b"hello", headers=headers)
        # THEN it maps to 403 Forbidden
        assert response.status_code == HTTPStatus.FORBIDDEN

    @pytest.mark.asyncio
    async def test_service_rate_limit_maps_to_429(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_user = client_with_mocks
        # GIVEN service raises CVUploadRateLimitExceededError when rate limit exceeded
        mocker.patch.object(mocked_service, "parse_cv", side_effect=CVUploadRateLimitExceededError("Too many CV uploads, try again later"))
        given_mime = next(iter(ALLOWED_MIME_TYPES))
        given_ext = next(iter(ALLOWED_EXTENSIONS))
        headers = {"Content-Type": given_mime, "x-filename": f"cv{given_ext}"}
        # WHEN uploading the CV
        response = client.post(f"/{mocked_user.user_id}/cv", data=b"hello", headers=headers)
        # THEN it maps to 429 Too Many Requests
        assert response.status_code == HTTPStatus.TOO_MANY_REQUESTS

    @pytest.mark.asyncio
    async def test_service_duplicate_cv_maps_to_409(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_user = client_with_mocks
        # GIVEN service raises DuplicateCVUploadError when duplicate CV is uploaded
        mocker.patch.object(mocked_service, "parse_cv", side_effect=DuplicateCVUploadError("duplicate_hash_123"))
        given_mime = next(iter(ALLOWED_MIME_TYPES))
        given_ext = next(iter(ALLOWED_EXTENSIONS))
        headers = {"Content-Type": given_mime, "x-filename": f"cv{given_ext}"}
        # WHEN uploading the CV
        response = client.post(f"/{mocked_user.user_id}/cv", data=b"hello", headers=headers)
        # THEN it maps to 409 Conflict
        assert response.status_code == HTTPStatus.CONFLICT
        assert "already been uploaded" in response.json()["detail"]

