import asyncio
import logging
from http import HTTPStatus

from fastapi import APIRouter, Depends, HTTPException, Path, UploadFile, File, Request
from pydantic import Field

from app.constants.errors import HTTPErrorResponse
from app.users.auth import Authentication, UserInfo
from .service import CVUploadService, ICVUploadService
from .types import CVUploadResponse


logger = logging.getLogger(__name__)


# 10 MB limit in bytes
MAX_CV_SIZE_BYTES = 10 * 1024 * 1024
# Allow ~1MB multipart overhead to avoid false positives on header-based checks
MAX_MULTIPART_OVERHEAD_BYTES = 1 * 1024 * 1024

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


def _validate_request_size_header(request: Request):
    """
    Validate Content-Length before reading the body to fail fast on oversized uploads.
    We use a margin for multipart overhead since Content-Length includes form boundaries and headers.
    """
    content_length_header = request.headers.get("content-length")
    if content_length_header is None:
        return
    try:
        content_length = int(content_length_header)
    except ValueError:
        return
    if content_length > (MAX_CV_SIZE_BYTES + MAX_MULTIPART_OVERHEAD_BYTES):
        raise HTTPException(status_code=HTTPStatus.REQUEST_ENTITY_TOO_LARGE, detail="Request exceeds maximum allowed size")


def _has_allowed_extension(filename: str) -> bool:
    lower = filename.lower()
    return any(lower.endswith(ext) for ext in ALLOWED_EXTENSIONS)


def _get_filename_from_headers(request: Request) -> str | None:
    # Prefer custom headers if provided by client
    for key in ["x-filename", "filename"]:
        val = request.headers.get(key)
        if val:
            return val
    # Fallback: try to extract from Content-Disposition if present
    cd = request.headers.get("content-disposition")
    if cd and "filename=" in cd:
        # naive parse: filename="..."
        try:
            part = cd.split("filename=")[1]
            if part.startswith('"'):
                return part.split('"')[1]
            return part.split(";")[0]
        except Exception:
            return None
    return None


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
        name="upload user CV (raw stream)",
        description=(
            "Upload a CV file as a raw stream. Send the file bytes as the request body, "
            "set Content-Type to one of txt/pdf/docx types, and include a 'filename' or 'x-filename' header."
        ),
    )
    async def _upload_cv_raw(
        request: Request,
        user_id: str = Path(description="the unique identifier of the user", examples=["1"]),
        user_info: UserInfo = Depends(auth.get_user_info()),
        service: ICVUploadService = Depends(_get_cv_service),
    ) -> CVUploadResponse:
        # Validate size early using Content-Length (no multipart overhead for raw)
        _validate_request_size_header(request)

        if user_info.user_id != user_id:
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail="Cannot upload CV for a different user")

        content_type = request.headers.get("content-type") or ""
        if content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(status_code=HTTPStatus.UNSUPPORTED_MEDIA_TYPE, detail="Only txt, pdf, docx formats are allowed")

        filename = _get_filename_from_headers(request) or ""
        if not filename or not _has_allowed_extension(filename):
            raise HTTPException(status_code=HTTPStatus.UNSUPPORTED_MEDIA_TYPE, detail="A valid filename header with .txt, .pdf, or .docx is required")

        total_read = 0
        chunks: list[bytes] = []
        try:
            async for chunk in request.stream():
                if not chunk:
                    break
                total_read += len(chunk)
                if total_read > MAX_CV_SIZE_BYTES:
                    raise HTTPException(status_code=HTTPStatus.REQUEST_ENTITY_TOO_LARGE, detail="CV exceeds 10MB limit")
                chunks.append(chunk)
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Oops! Something went wrong.")

        file_bytes = b"".join(chunks)

        try:
            parsed = await service.parse_cv(
                user_id=user_id,
                file_bytes=file_bytes,
                filename=filename,
                content_type=content_type,
            )
            return CVUploadResponse(experiences_data=parsed.experiences_data)
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Oops! Something went wrong.")

    users_router.include_router(router)

   


