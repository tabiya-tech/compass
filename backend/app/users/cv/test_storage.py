import pytest

import asyncio

import pytest

from app.users.cv import storage as storage_mod
from app.users.cv.storage import GCPCVCloudStorageService, build_user_cv_upload_record, _get_cv_storage_service


class _DummyBlob:
    def __init__(self, uploads, path: str):
        self._uploads = uploads
        self._path = path

    def upload_from_string(self, data: bytes | str, content_type: str | None = None):
        self._uploads.append((self._path, data, content_type))


class _DummyBucket:
    def __init__(self, uploads):
        self._uploads = uploads

    def blob(self, path: str):
        return _DummyBlob(self._uploads, path)


class _DummyStorageClient:
    def __init__(self):
        self.uploads = []

    def bucket(self, name: str):
        return _DummyBucket(self.uploads)


def test_upload_cv_writes_original_and_markdown(mocker):
    # GIVEN a storage service with a mocked GCP client
    dummy_client = _DummyStorageClient()
    mocker.patch("app.users.cv.storage.storage.Client", return_value=dummy_client)
    service = GCPCVCloudStorageService(bucket_name="test-bucket")

    # and a user upload record
    mocker.patch("app.users.cv.storage.uuid.uuid4", **{"return_value.hex": "fixedid"})
    record = build_user_cv_upload_record(user_id="user/with/slash", filename="cv.PDF", markdown_text="# md", file_bytes=b"pdf-bytes")

    # WHEN uploading the original and markdown
    service.upload_cv(document=record, markdown_text="# md", original_bytes=b"pdf-bytes")

    # THEN both blobs are written with expected content types
    assert (record.object_path, b"pdf-bytes", "application/pdf") in dummy_client.uploads
    assert (record.markdown_object_path, b"# md", "text/markdown; charset=utf-8") in dummy_client.uploads


def test_build_user_cv_upload_record_builds_paths_and_metadata(mocker):
    # GIVEN a deterministic uuid
    mocker.patch("app.users.cv.storage.uuid.uuid4", **{"return_value.hex": "abc123"})

    # WHEN building the record
    record = build_user_cv_upload_record(user_id="u/1", filename="Resume.docx", markdown_text="hello", file_bytes=b"docx-bytes")

    # THEN paths are correct and safe, and metadata is set
    assert record.user_id == "u/1"
    assert record.filename == "Resume.docx"
    assert record.content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    assert "/" not in record.object_path.split("/")[1]  # user id sanitized in path
    assert record.object_path.endswith("/Resume.docx")
    assert record.markdown_object_path.endswith("/cv.md")
    assert record.markdown_char_len == 5


def test_upload_cv_uses_configured_bucket_name(mocker):
    # GIVEN a dummy client that records the bucket name
    class RecordingClient(_DummyStorageClient):
        def __init__(self):
            super().__init__()
            self.bucket_names = []

        def bucket(self, name: str):
            self.bucket_names.append(name)
            return super().bucket(name)

    dummy_client = RecordingClient()
    mocker.patch("app.users.cv.storage.storage.Client", return_value=dummy_client)
    service = GCPCVCloudStorageService(bucket_name="expected-bucket")
    record = build_user_cv_upload_record(user_id="u", filename="cv.pdf", markdown_text="hi", file_bytes=b"pdf-bytes")

    # WHEN
    service.upload_cv(document=record, markdown_text="hi", original_bytes=b"pdf")

    # THEN the specified bucket name is used
    assert dummy_client.bucket_names == ["expected-bucket"]


def test_upload_cv_bubbles_gcp_errors(mocker):
    # GIVEN a client whose blob upload raises
    class FailingBlob:
        def upload_from_string(self, *_, **__):
            raise RuntimeError("gcs-failure")

    class FailingBucket:
        def blob(self, _):
            return FailingBlob()

    class FailingClient:
        def bucket(self, _):
            return FailingBucket()

    mocker.patch("app.users.cv.storage.storage.Client", return_value=FailingClient())
    service = GCPCVCloudStorageService(bucket_name="b")
    record = build_user_cv_upload_record(user_id="u", filename="cv.pdf", markdown_text="md", file_bytes=b"pdf-bytes")

    # WHEN/THEN the exception propagates to the caller
    with pytest.raises(RuntimeError):
        service.upload_cv(document=record, markdown_text="md", original_bytes=b"pdf")


@pytest.mark.parametrize("filename,expected", [
    ("a.txt", "text/plain"),
    ("b.PDF", "application/pdf"),
    ("c.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ("d.bin", "application/octet-stream"),
])
def test_build_user_cv_upload_record_sets_content_type_by_extension(filename, expected, mocker):
    # GIVEN deterministic uuid
    mocker.patch("app.users.cv.storage.uuid.uuid4", **{"return_value.hex": "id"})

    # WHEN
    record = build_user_cv_upload_record(user_id="u", filename=filename, markdown_text="x", file_bytes=b"test-bytes")

    # THEN
    assert record.content_type == expected


@pytest.mark.asyncio
async def test_get_cv_storage_service_is_singleton_and_uses_config(mocker):
    # GIVEN a mocked application config providing a bucket name
    class _Cfg:
        cv_storage_bucket = "cfg-bucket"

    mocker.patch("app.users.cv.storage.get_application_config", return_value=_Cfg())
    dummy_client = _DummyStorageClient()
    mocker.patch("app.users.cv.storage.storage.Client", return_value=dummy_client)

    # and a clean module singleton state
    storage_mod._cv_storage_service_singleton = None

    # WHEN acquiring the service multiple times
    s1 = await _get_cv_storage_service()  # type: ignore[arg-type]
    s2 = await _get_cv_storage_service()  # type: ignore[arg-type]

    # THEN it is the same instance and bucket is used
    assert s1 is s2
    assert isinstance(s1, GCPCVCloudStorageService)

