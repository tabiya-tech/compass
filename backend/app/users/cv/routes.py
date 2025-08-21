import asyncio
import logging
from http import HTTPStatus

from fastapi import APIRouter, Depends, HTTPException, Path, Request
from pydantic import Field

from app.constants.errors import HTTPErrorResponse
from app.users.cv.constants import (
    MAX_CV_SIZE_BYTES,
    MAX_MULTIPART_OVERHEAD_BYTES,
    ALLOWED_MIME_TYPES,
    ALLOWED_EXTENSIONS,
)
from app.users.cv.errors import MarkdownTooLongError, PayloadTooLargeErrorResponse
from app.users.auth import Authentication, UserInfo
from .service import CVUploadService, ICVUploadService
from .types import ParsedCV


logger = logging.getLogger(__name__)


class _PayloadTooLargeErrorResponse(PayloadTooLargeErrorResponse):
    pass


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
        logger.warning(
            "413 via header-check: content_length=%s limit=%s overhead_margin=%s",
            content_length,
            MAX_CV_SIZE_BYTES,
            MAX_MULTIPART_OVERHEAD_BYTES,
        )
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
        response_model=ParsedCV,
        responses={
            HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},
            HTTPStatus.UNSUPPORTED_MEDIA_TYPE: {"model": HTTPErrorResponse},
            HTTPStatus.REQUEST_ENTITY_TOO_LARGE: {"model": _PayloadTooLargeErrorResponse},
            HTTPStatus.BAD_REQUEST: {"model": HTTPErrorResponse},
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
        name="upload user CV",
        description=(
            "Upload a CV file by streaming the raw request body. Set Content-Type to one of txt/pdf/docx types. "
            "Optionally include a 'filename' or 'x-filename' header; otherwise the filename will be inferred."
        ),
        openapi_extra={
            "requestBody": {
                "required": True,
                "content": {
                    "application/pdf": {"schema": {"type": "string", "format": "binary"}},
                    "text/plain": {"schema": {"type": "string", "format": "binary"}},
                },
            }
        },
    )
    async def _upload_cv(
        request: Request,
        user_id: str = Path(description="the unique identifier of the user", examples=["1"]),
        user_info: UserInfo = Depends(auth.get_user_info()),
        service: ICVUploadService = Depends(_get_cv_service),
    ) -> ParsedCV:
        # Validate size early using Content-Length (no multipart overhead for raw)
        _validate_request_size_header(request)

        if user_info.user_id != user_id:
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail="Cannot upload CV for a different user")

        content_type = request.headers.get("content-type") or ""

        if content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(status_code=HTTPStatus.UNSUPPORTED_MEDIA_TYPE, detail="Only txt, pdf, docx formats are allowed")

        filename = _get_filename_from_headers(request) or ""
        if not filename:
            if content_type == "text/plain":
                filename = "upload.txt"
            elif content_type == "application/pdf":
                filename = "upload.pdf"
            elif content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
                filename = "upload.docx"
        if filename and not _has_allowed_extension(filename):
            raise HTTPException(status_code=HTTPStatus.UNSUPPORTED_MEDIA_TYPE, detail="Only txt, pdf, docx filename extensions are allowed")

        total_read = 0
        chunks: list[bytes] = []
        try:
            async for chunk in request.stream():
                logger.info("recv-chunk bytes=%s", len(chunk))
                if not chunk:
                    break
                total_read += len(chunk)
                if total_read > MAX_CV_SIZE_BYTES:
                    logger.warning("413 via streaming-read: total_read_bytes=%s limit=%s", total_read, MAX_CV_SIZE_BYTES)
                    raise HTTPException(status_code=HTTPStatus.REQUEST_ENTITY_TOO_LARGE, detail="CV exceeds 10MB limit")
                chunks.append(chunk)
        except HTTPException:
            raise
        except MarkdownTooLongError as e:
            raise HTTPException(status_code=HTTPStatus.REQUEST_ENTITY_TOO_LARGE, detail=str(e))
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Oops! Something went wrong.")

        file_bytes = b"".join(chunks)
        logger.info(
            "cv-upload read complete: bytes=%s filename='%s' content_type='%s'",
            len(file_bytes),
            filename,
            content_type,
        )

        try:
            parsed = await service.parse_cv(
                user_id=user_id,
                file_bytes=file_bytes,
                filename=filename,
                content_type=content_type,
            )
            return ParsedCV(experiences_data=parsed.experiences_data)
        except MarkdownTooLongError as e:
            # Map markdown length guard to 413 Payload Too Large
            length = getattr(e, "length", None)
            limit = getattr(e, "limit", None)
            logger.warning("413 via markdown-length: converted_len=%s limit=%s filename='%s'", length, limit, filename)
            raise HTTPException(status_code=HTTPStatus.REQUEST_ENTITY_TOO_LARGE, detail=str(e))
        except HTTPException:
            raise
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Oops! Something went wrong.")

    users_router.include_router(router)

   


