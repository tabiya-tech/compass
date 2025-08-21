import asyncio
import logging
from http import HTTPStatus

from fastapi import APIRouter, Depends, HTTPException, Path, UploadFile, File
from pydantic import Field

from app.constants.errors import HTTPErrorResponse
from app.users.auth import Authentication, UserInfo
from .service import CVUploadService, ICVUploadService
from .types import CVUploadResponse


logger = logging.getLogger(__name__)


# 10 MB limit in bytes
MAX_CV_SIZE_BYTES = 10 * 1024 * 1024

# Allowed content types and extensions
ALLOWED_MIME_TYPES = {
    "text/plain",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
ALLOWED_EXTENSIONS = {".txt", ".pdf", ".docx"}


class _PayloadTooLargeErrorResponse(HTTPErrorResponse):
    detail: str = Field(description="Error message indicating payload exceeded the size limit")


_cv_service_lock = asyncio.Lock()
_cv_service_singleton: ICVUploadService | None = None


async def _get_cv_service() -> ICVUploadService:
    global _cv_service_singleton
    if _cv_service_singleton is None:
        async with _cv_service_lock:
            if _cv_service_singleton is None:
                _cv_service_singleton = CVUploadService()
    return _cv_service_singleton


# Public alias for dependency override in tests
get_cv_service = _get_cv_service


def _has_allowed_extension(filename: str) -> bool:
    lower = filename.lower()
    return any(lower.endswith(ext) for ext in ALLOWED_EXTENSIONS)


def add_user_cv_routes(users_router: APIRouter, auth: Authentication):
    router = APIRouter(prefix="/{user_id}/cv", tags=["users-cv"])

    @router.post(
        path="",
        status_code=HTTPStatus.OK,
        response_model=CVUploadResponse,
        responses={
            HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},
            HTTPStatus.UNSUPPORTED_MEDIA_TYPE: {"model": HTTPErrorResponse},
            HTTPStatus.REQUEST_ENTITY_TOO_LARGE: {"model": _PayloadTooLargeErrorResponse},
            HTTPStatus.BAD_REQUEST: {"model": HTTPErrorResponse},
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
        name="upload user CV",
        description="Upload a CV file for a user. Only txt, pdf, docx up to 10MB are allowed."
    )
    async def _upload_cv(
        user_id: str = Path(description="the unique identifier of the user", examples=["1"]),
        file: UploadFile = File(..., description="CV file in txt, pdf, or docx format"),
        user_info: UserInfo = Depends(auth.get_user_info()),
        service: ICVUploadService = Depends(_get_cv_service),
    ) -> CVUploadResponse:
        if user_info.user_id != user_id:
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail="Cannot upload CV for a different user")

        # Validate content type and extension
        if (file.content_type not in ALLOWED_MIME_TYPES) or (not _has_allowed_extension(file.filename or "")):
            raise HTTPException(status_code=HTTPStatus.UNSUPPORTED_MEDIA_TYPE, detail="Only txt, pdf, docx formats are allowed")

        # Read file content in 1MB chunks
        total_read = 0
        chunks: list[bytes] = []
        try:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                total_read += len(chunk)
                if total_read > MAX_CV_SIZE_BYTES:
                    raise HTTPException(status_code=HTTPStatus.REQUEST_ENTITY_TOO_LARGE, detail="CV exceeds 10MB limit")
                chunks.append(chunk)
        finally:
            await file.close()

        file_bytes = b"".join(chunks)

        try:
            parsed = await service.parse_cv(
                user_id=user_id,
                file_bytes=file_bytes,
                filename=file.filename or "",
                content_type=file.content_type,
            )
            return CVUploadResponse(experiences_data=parsed.experiences_data)
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Oops! Something went wrong.")

    users_router.include_router(router)


