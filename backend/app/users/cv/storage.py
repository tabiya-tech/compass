import asyncio
import hashlib
import uuid

from abc import ABC, abstractmethod
from datetime import datetime, timezone

from fastapi import Depends
from google.cloud import storage

from app.app_config import get_application_config
from app.users.cv.types import UserCVUpload
import logging

class ICVCloudStorageService(ABC):
    @abstractmethod
    def upload_cv(self,
                  *,
                  document: UserCVUpload,
                  markdown_text: str,
                  original_bytes: bytes) -> None:
        raise NotImplementedError()


_cv_storage_service_lock = asyncio.Lock()
_cv_storage_service_singleton: ICVCloudStorageService | None = None


async def _get_cv_storage_service(cv_storage_bucket_name: str = Depends(
    lambda: get_application_config().cv_storage_bucket)) -> ICVCloudStorageService:
    global _cv_storage_service_singleton
    if _cv_storage_service_singleton is None:
        async with _cv_storage_service_lock:
            if _cv_storage_service_singleton is None:
                _cv_storage_service_singleton = GCPCVCloudStorageService(cv_storage_bucket_name)
    return _cv_storage_service_singleton


def _get_content_type(filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".txt"):
        return "text/plain"
    if lower.endswith(".pdf"):
        return "application/pdf"
    if lower.endswith(".docx"):
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    return "application/octet-stream"


def build_user_cv_upload_record(*,
                                user_id: str,
                                filename: str,
                                markdown_text: str,
                                file_bytes: bytes) -> UserCVUpload:
    unique_id = uuid.uuid4().hex
    safe_user = user_id.replace("/", "_")
    object_prefix = f"users/{safe_user}/{unique_id}"

    original_object_path = f"{object_prefix}/{filename}"
    markdown_object_path = f"{object_prefix}/cv.md"

    return UserCVUpload(
        user_id=user_id,
        created_at=datetime.now(timezone.utc),
        filename=filename,
        content_type=_get_content_type(filename),
        object_path=original_object_path,
        markdown_object_path=markdown_object_path,
        markdown_char_len=len(markdown_text),
        md5_hash=hashlib.md5(file_bytes).hexdigest()  # nosec - MD5 is fine for non-cryptographic uses
    )


class GCPCVCloudStorageService(ICVCloudStorageService):
    def __init__(self, bucket_name: str):
        # Lazy init storage client
        self._client = storage.Client()
        self._bucket = self._client.bucket(bucket_name)

    def upload_cv(self,
                  *,
                  document: UserCVUpload,
                  markdown_text: str,
                  original_bytes: bytes):
        try:
            # 1. Upload original document
            # Ensure the original file is stored with the correct content type so that
            # downloads/open-in-browser work properly for pdf/docx/txt.
            self._bucket.blob(document.object_path).upload_from_string(
                original_bytes,
                content_type=document.content_type,
            )

            # 2. Upload Markdown (plain utf-8; compression optional in later step)
            self._bucket.blob(document.markdown_object_path).upload_from_string(
                markdown_text.encode("utf-8"),
                content_type="text/markdown; charset=utf-8")
        except Exception as e:

            logger = logging.getLogger(self.__class__.__name__)
            logger.error("Failed to upload CV to GCS (continuing without upload): %s", str(e))
            # If google cloud storage is not available, we continue without GCS upload
            # we will log a error and continue without GCS upload
            # The database record will still be saved so polling works
            # TODO: Remember to add raise