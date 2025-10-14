from types import SimpleNamespace
from datetime import datetime, timezone
from http import HTTPStatus
from typing import Optional

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
from app.users.cv.service import ICVUploadService
from app.users.cv.errors import MarkdownTooLongError, EmptyMarkdownError, \
    CVLimitExceededError, CVUploadRateLimitExceededError, DuplicateCVUploadError, MarkdownConversionTimeoutError
from app.users.cv.types import UserCVUpload, UploadProcessState
from common_libs.test_utilities.mock_auth import MockAuth

TestClientWithMocks = tuple[TestClient, ICVUploadService, UserInfo]


@pytest.fixture(scope='function')
def client_with_mocks() -> TestClientWithMocks:
    class MockCVService(ICVUploadService):
        async def parse_cv(self, *, user_id: str, file_bytes: bytes, filename: str):
            # Service returns upload_id string per contract
            return "test-upload-id"

        async def cancel_upload(self, *, user_id: str, upload_id: str) -> bool:
            return True

        async def get_upload_status(self, *, user_id: str, upload_id: str) -> Optional[dict]:
            return {
                "upload_id": upload_id,
                "user_id": user_id,
                "filename": "test.pdf",
                "upload_process_state": "COMPLETED",
                "cancel_requested": False,
                "created_at": "2025-01-01T00:00:00Z",
                "last_activity_at": "2025-01-01T00:00:00Z",
            }

        async def get_user_cvs(self, *, user_id: str) -> list[dict]:
            return [
                {
                    "upload_id": "upload-1",
                    "filename": "cv1.pdf",
                    "uploaded_at": "2025-01-01T00:00:00Z",
                    "upload_process_state": "COMPLETED",
                    "experiences_data": ["Experience 1", "Experience 2"],
                },

            ]

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
        expected_response = {"upload_id": "test-upload-id"}

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
        expected_response = {"upload_id": "test-upload-id"}

        # WHEN uploading the CV via raw streaming body
        response = client.post(f"/{given_user_id}/cv", data=given_file_content, headers=headers)

        # THEN the request succeeds
        assert response.status_code == HTTPStatus.OK
        assert response.json() == expected_response

    @pytest.mark.asyncio
    async def test_forbidden_other_user(self, client_with_mocks: TestClientWithMocks,
                                        mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_user = client_with_mocks
        parse_spy = mocker.spy(mocked_service, "parse_cv")
        # GIVEN a different user id and a valid file
        given_other_user_id = mocked_user.user_id + "_x"
        given_mime = next(iter(ALLOWED_MIME_TYPES))
        given_ext = next(iter(ALLOWED_EXTENSIONS))
        given_file_content = b"hello"
        headers = {"Content-Type": given_mime, "x-filename": f"cv{given_ext}"}

        # WHEN uploading the CV for another user
        response = client.post(f"/{given_other_user_id}/cv",
                               files={"file": ("cv" + given_ext, given_file_content, given_mime)}, headers=headers)

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
    async def test_service_markdown_too_long_maps_to_413(self, client_with_mocks: TestClientWithMocks,
                                                         mocker: pytest_mock.MockerFixture):
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
    async def test_service_timeout_maps_to_408(self, client_with_mocks: TestClientWithMocks,
                                               mocker: pytest_mock.MockerFixture):
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
    async def test_service_empty_markdown_maps_to_422(self, client_with_mocks: TestClientWithMocks,
                                                      mocker: pytest_mock.MockerFixture):
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
    async def test_service_max_uploads_maps_to_403(self, client_with_mocks: TestClientWithMocks,
                                                   mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_user = client_with_mocks
        # GIVEN service raises CVLimitExceededError when user exceeds uploads
        mocker.patch.object(mocked_service, "parse_cv",
                            side_effect=CVLimitExceededError("Maximum number of CV uploads reached"))
        given_mime = next(iter(ALLOWED_MIME_TYPES))
        given_ext = next(iter(ALLOWED_EXTENSIONS))
        headers = {"Content-Type": given_mime, "x-filename": f"cv{given_ext}"}
        # WHEN uploading the CV
        response = client.post(f"/{mocked_user.user_id}/cv", data=b"hello", headers=headers)
        # THEN it maps to 403 Forbidden
        assert response.status_code == HTTPStatus.FORBIDDEN

    @pytest.mark.asyncio
    async def test_service_rate_limit_maps_to_429(self, client_with_mocks: TestClientWithMocks,
                                                  mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_user = client_with_mocks
        # GIVEN service raises CVUploadRateLimitExceededError when rate limit exceeded
        mocker.patch.object(mocked_service, "parse_cv",
                            side_effect=CVUploadRateLimitExceededError("Too many CV uploads, try again later"))
        given_mime = next(iter(ALLOWED_MIME_TYPES))
        given_ext = next(iter(ALLOWED_EXTENSIONS))
        headers = {"Content-Type": given_mime, "x-filename": f"cv{given_ext}"}
        # WHEN uploading the CV
        response = client.post(f"/{mocked_user.user_id}/cv", data=b"hello", headers=headers)
        # THEN it maps to 429 Too Many Requests
        assert response.status_code == HTTPStatus.TOO_MANY_REQUESTS

    @pytest.mark.asyncio
    async def test_service_duplicate_cv_maps_to_409(self, client_with_mocks: TestClientWithMocks,
                                                    mocker: pytest_mock.MockerFixture):
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


class TestCancelCVUpload:
    @pytest.mark.asyncio
    async def test_cancel_upload_success(self, client_with_mocks: TestClientWithMocks,
                                         mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_user = client_with_mocks
        # GIVEN service cancel returns True
        mocker.patch.object(mocked_service, "cancel_upload", return_value=True)

        # WHEN cancelling an upload
        resp = client.post(f"/{mocked_user.user_id}/cv/test-upload-id/cancel")

        # THEN 200 OK and payload echoed
        assert resp.status_code == HTTPStatus.OK
        body = resp.json()
        assert body["upload_id"] == "test-upload-id"

    @pytest.mark.asyncio
    async def test_cancel_upload_not_found(self, client_with_mocks: TestClientWithMocks,
                                           mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_user = client_with_mocks
        # GIVEN service cancel returns False (not found or already terminal)
        mocker.patch.object(mocked_service, "cancel_upload", return_value=False)

        # WHEN cancelling an upload
        resp = client.post(f"/{mocked_user.user_id}/cv/missing-id/cancel")

        # THEN 404 Not Found
        assert resp.status_code == HTTPStatus.NOT_FOUND
        assert "Upload not found" in resp.json()["detail"]

    @pytest.mark.asyncio
    async def test_cancel_upload_forbidden_other_user(self, client_with_mocks: TestClientWithMocks):
        client, _, mocked_user = client_with_mocks
        # WHEN cancelling with mismatched user id
        other_user = mocked_user.user_id + "_x"
        resp = client.post(f"/{other_user}/cv/test-upload-id/cancel")
        # THEN 403 Forbidden
        assert resp.status_code == HTTPStatus.FORBIDDEN

    @pytest.mark.asyncio
    async def test_cancel_upload_service_exception_maps_to_500(self, client_with_mocks: TestClientWithMocks,
                                                               mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_user = client_with_mocks
        # GIVEN service raises unexpected exception
        mocker.patch.object(mocked_service, "cancel_upload", side_effect=Exception("boom"))

        # WHEN cancelling the upload
        resp = client.post(f"/{mocked_user.user_id}/cv/any-id/cancel")

        # THEN 500 Internal Server Error
        assert resp.status_code == HTTPStatus.INTERNAL_SERVER_ERROR


class TestGetUploadStatus:
    @pytest.mark.asyncio
    async def test_get_upload_status_success(self, client_with_mocks: TestClientWithMocks):
        client, _, mocked_user = client_with_mocks
        # GIVEN a valid user and upload ID

        # WHEN getting upload status
        resp = client.get(f"/{mocked_user.user_id}/cv/test-upload-id")

        # THEN 200 OK with status info
        assert resp.status_code == HTTPStatus.OK
        body = resp.json()
        assert body["upload_id"] == "test-upload-id"
        assert body["user_id"] == mocked_user.user_id
        assert body["upload_process_state"] == "COMPLETED"
        assert body["cancel_requested"] is False

    @pytest.mark.asyncio
    async def test_get_upload_status_forbidden_other_user(self, client_with_mocks: TestClientWithMocks):
        client, _, mocked_user = client_with_mocks
        # WHEN reading status with mismatched user id
        other_user = mocked_user.user_id + "_x"
        resp = client.get(f"/{other_user}/cv/test-upload-id")
        # THEN 403 Forbidden
        assert resp.status_code == HTTPStatus.FORBIDDEN

    @pytest.mark.asyncio
    async def test_get_upload_status_not_found(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_user = client_with_mocks
        # GIVEN service returns None (upload not found)
        mocker.patch.object(mocked_service, "get_upload_status", return_value=None)

        # WHEN getting status for non-existent upload
        resp = client.get(f"/{mocked_user.user_id}/cv/missing-id")

        # THEN 404 Not Found
        assert resp.status_code == HTTPStatus.NOT_FOUND
        assert "Upload not found" in resp.json()["detail"]

    @pytest.mark.asyncio
    async def test_get_upload_status_service_exception_maps_to_500(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_user = client_with_mocks
        # GIVEN service raises unexpected exception
        mocker.patch.object(mocked_service, "get_upload_status", side_effect=Exception("boom"))

        # WHEN getting upload status
        resp = client.get(f"/{mocked_user.user_id}/cv/any-id")

        # THEN 500 Internal Server Error
        assert resp.status_code == HTTPStatus.INTERNAL_SERVER_ERROR

class TestGetUploadedCVs:
    @pytest.mark.asyncio
    async def test_get_uploaded_cvs_success(self, client_with_mocks: TestClientWithMocks,
                                            mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_user = client_with_mocks

        # GIVEN service returns a list of uploads
        uploads = [
            SimpleNamespace(
                upload_id="upload-1",
                filename="cv1.pdf",
                created_at=datetime(2025, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
                upload_process_state="COMPLETED",
                experience_bullets=["Experience 1", "Experience 2"],
            ),
            SimpleNamespace(
                upload_id="upload-2",
                filename="cv2.docx",
                created_at=datetime(2025, 1, 2, 0, 0, 0, tzinfo=timezone.utc),
                upload_process_state="COMPLETED",
                experience_bullets=["Experience 1"],
            ),
        ]
        mock_get_user_cvs = mocker.patch.object(
            mocked_service, "get_user_cvs", mocker.AsyncMock(return_value=uploads)
        )

        # WHEN getting uploaded CVs
        resp = client.get(f"/{mocked_user.user_id}/cv")

        # THEN service is called with the correct user ID
        mock_get_user_cvs.assert_called_once_with(user_id=mocked_user.user_id)

        # AND the response is 200 OK with expected data
        assert resp.status_code == HTTPStatus.OK
        body = resp.json()
        assert isinstance(body, list)
        assert len(body) == 2

        # AND each item matches expected uploads
        for item, expected in zip(body, uploads):
            assert item["upload_id"] == expected.upload_id
            assert item["filename"] == expected.filename
            returned_dt = datetime.fromisoformat(item["uploaded_at"].replace("Z", "+00:00"))
            assert returned_dt == expected.created_at
            assert item["upload_process_state"] == expected.upload_process_state
            assert item["experiences_data"] == expected.experience_bullets

    @pytest.mark.asyncio
    async def test_get_uploaded_cvs_forbidden_other_user(self, client_with_mocks: TestClientWithMocks, mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_user = client_with_mocks
        # GIVEN a mocked service
        get_user_cvs_mock = mocker.patch.object(mocked_service, "get_user_cvs", mocker.AsyncMock())

        # WHEN reading uploads with mismatched user id
        other_user = mocked_user.user_id + "_x"
        resp = client.get(f"/{other_user}/cv")

        # THEN 403 Forbidden and service not called
        assert resp.status_code == HTTPStatus.FORBIDDEN
        get_user_cvs_mock.assert_not_called()

    @pytest.mark.asyncio
    async def test_get_uploaded_cvs_service_exception_maps_to_500(self, client_with_mocks: TestClientWithMocks,
                                                                 mocker: pytest_mock.MockerFixture):
        client, mocked_service, mocked_user = client_with_mocks
        # GIVEN service raises unexpected exception
        mocker.patch.object(mocked_service, "get_user_cvs", side_effect=Exception("boom"))

        # WHEN getting uploaded CVs
        resp = client.get(f"/{mocked_user.user_id}/cv")

        # THEN 500 Internal Server Error
        assert resp.status_code == HTTPStatus.INTERNAL_SERVER_ERROR
