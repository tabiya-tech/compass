import asyncio
import logging
import os
from http import HTTPStatus

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, FastAPI

from app.constants.errors import HTTPErrorResponse
from app.users.auth import Authentication, UserInfo
from app.users.cv.constants import (
    MAX_CV_SIZE_BYTES,
    MAX_MULTIPART_OVERHEAD_BYTES,
    ALLOWED_MIME_TYPES,
    ALLOWED_EXTENSIONS,
)
from app.users.cv.errors import MarkdownConversionTimeoutError, MarkdownTooLongError, PayloadTooLargeErrorResponse, \
    EmptyMarkdownError, CVLimitExceededError, CVUploadRateLimitExceededError, DuplicateCVUploadError
from app.users.cv.get_repository import get_user_cv_repository
from app.users.cv.repository import IUserCVRepository
from app.users.cv.service import CVUploadService, ICVUploadService
from app.users.cv.storage import _get_cv_storage_service, ICVCloudStorageService
from app.users.cv.types import CVUploadStatusResponse, CVUploadResponseListItem, PublicReportResponse
from app.users.get_user_preferences_repository import get_user_preferences_repository
from app.users.repositories import IUserPreferenceRepository
from app.logger import log_non_pii_warning
from app.conversations.experience.get_experience_service import get_experience_service
from app.conversations.experience.service import IExperienceService
from app.conversations.experience._types import ExperienceResponse

logger = logging.getLogger(__name__)


class _PayloadTooLargeErrorResponse(PayloadTooLargeErrorResponse):
    pass


_cv_service_lock = asyncio.Lock()
_cv_service_singleton: ICVUploadService | None = None


async def _get_cv_service(
        repository: IUserCVRepository = Depends(get_user_cv_repository),
        cv_storage_service: ICVCloudStorageService = Depends(_get_cv_storage_service)) -> ICVUploadService:

    global _cv_service_singleton
    if _cv_service_singleton is None:
        async with _cv_service_lock:
            if _cv_service_singleton is None:
                _cv_service_singleton = CVUploadService(repository=repository, cv_cloud_storage_service=cv_storage_service)
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
        response_model=dict,
        responses={
            HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},
            HTTPStatus.UNSUPPORTED_MEDIA_TYPE: {"model": HTTPErrorResponse},
            HTTPStatus.REQUEST_ENTITY_TOO_LARGE: {"model": _PayloadTooLargeErrorResponse},
            HTTPStatus.TOO_MANY_REQUESTS: {"model": HTTPErrorResponse},
            HTTPStatus.CONFLICT: {"model": HTTPErrorResponse},
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
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {"schema": {"type": "string", "format": "binary"}},
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
    ) -> dict:
        # Validate size early using Content-Length (no multipart overhead for raw)
        _validate_request_size_header(request)
        content_length_header = request.headers.get("content-length")

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
        logger.info(
            "CV upload started {user_id=%s, content_type='%s', content_length=%s, filename='%s'}",
            user_id,
            content_type,
            content_length_header,
            filename,
        )
        if not _has_allowed_extension(filename):
            raise HTTPException(status_code=HTTPStatus.UNSUPPORTED_MEDIA_TYPE, detail="Only txt, pdf, docx filename extensions are allowed")

        total_read = 0
        chunks: list[bytes] = []
        try:
            logger.info(
                "Receiving file data {filename='%s', max_size_bytes=%s}",
                filename,
                MAX_CV_SIZE_BYTES,
            )
            async for chunk in request.stream():
                logger.debug("Streaming chunk received {chunk_bytes=%s}", len(chunk) if chunk else 0)
                if not chunk:
                    break
                total_read += len(chunk)
                if total_read > MAX_CV_SIZE_BYTES:
                    logger.warning(
                        "Upload aborted: file exceeds max size {total_read_bytes=%s, max_bytes=%s}",
                        total_read,
                        MAX_CV_SIZE_BYTES,
                    )
                    raise HTTPException(status_code=HTTPStatus.REQUEST_ENTITY_TOO_LARGE, detail=f"CV exceeds {MAX_CV_SIZE_BYTES/1024/1024}MB limit")
                chunks.append(chunk)
        except HTTPException:
            raise
        except MarkdownTooLongError as e:
            raise HTTPException(status_code=HTTPStatus.REQUEST_ENTITY_TOO_LARGE, detail=str(e))
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Oops! Something went wrong.")

        file_bytes = b"".join(chunks)
        logger.info("Finished receiving file {filename='%s', total_bytes=%s, content_type='%s'}", filename, len(file_bytes), content_type)

        try:
            logger.info("Processing CV {filename='%s', size_bytes=%s}", filename, len(file_bytes))
            upload_id = await service.parse_cv(
                user_id=user_id,
                file_bytes=file_bytes,
                filename=filename,
            )
            logger.info("CV processed successfully {user_id=%s, upload_id=%s}", user_id, upload_id)
            return {"upload_id": upload_id}
        except MarkdownTooLongError as e:
            # Map markdown length guard to 413 Payload Too Large
            length = getattr(e, "length", None)
            limit = getattr(e, "limit", None)
            logger.warning("413 via markdown-length: converted_len=%s limit=%s filename='%s'", length, limit, filename)
            raise HTTPException(status_code=HTTPStatus.REQUEST_ENTITY_TOO_LARGE, detail=str(e))
        except EmptyMarkdownError as e:
            logger.warning("Markdown conversion returned empty content {filename='%s'}", filename)
            raise HTTPException(status_code=HTTPStatus.UNPROCESSABLE_ENTITY, detail=str(e))
        except MarkdownConversionTimeoutError as e:
            logger.error(str(e))
            raise HTTPException(status_code=HTTPStatus.REQUEST_TIMEOUT, detail=str(e))
        except HTTPException:
            raise
        except CVLimitExceededError as e:
            logger.warning("Max uploads per user exceeded {user_id=%s}", user_id)
            raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail=str(e))
        except CVUploadRateLimitExceededError as e:
            logger.warning("Rate limit exceeded for user {user_id=%s}", user_id)
            raise HTTPException(status_code=HTTPStatus.TOO_MANY_REQUESTS, detail=str(e))
        except DuplicateCVUploadError as e:
            logger.warning("Duplicate CV upload detected {user_id=%s, md5_hash=%s}", user_id, e.md5_hash)
            raise HTTPException(status_code=HTTPStatus.CONFLICT, detail="This CV has already been uploaded")
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=HTTPStatus.INTERNAL_SERVER_ERROR, detail="Oops! Something went wrong.")

    @router.post("/{upload_id}/cancel", response_model=dict)
    async def cancel_cv_upload(
        user_id: str = Path(..., description="User ID"),
        upload_id: str = Path(..., description="Upload ID to cancel"),
        service: ICVUploadService = Depends(get_cv_service),
        user_info: UserInfo = Depends(auth.get_user_info()),
    ) -> dict:
        """
        Cancel an ongoing CV upload process.
        """
        try:
            if user_info.user_id != user_id:
                raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail="Cannot cancel CV for a different user")
            # Request cancellation through the service
            success = await service.cancel_upload(user_id=user_id, upload_id=upload_id)
            
            if not success:
                raise HTTPException(
                    status_code=HTTPStatus.NOT_FOUND, 
                    detail="Upload not found or already completed/failed"
                )
            
            return {"upload_id": upload_id}
            
        except HTTPException:
            # Re-raise HTTP exceptions (like 404) as-is
            raise
        except Exception as e:
            logger.exception(e)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR, 
                detail="Failed to cancel upload"
            )

    @router.get("/{upload_id}", response_model=CVUploadStatusResponse)
    async def get_upload_status(
        user_id: str = Path(..., description="User ID"),
        upload_id: str = Path(..., description="Upload ID to get status for"),
        service: ICVUploadService = Depends(get_cv_service),
        user_info: UserInfo = Depends(auth.get_user_info()),
    ):
        """
        Get the status of an upload process.
        """
        try:
            if user_info.user_id != user_id:
                raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail="Cannot read CV status for a different user")
            # Get upload status through the service
            status_info = await service.get_upload_status(user_id=user_id, upload_id=upload_id)
            
            if not status_info:
                raise HTTPException(
                    status_code=HTTPStatus.NOT_FOUND,
                    detail="Upload not found"
                )
            
            return status_info
            
        except HTTPException:
            # Re-raise HTTP exceptions (like 404) as-is
            raise
        except Exception as e:
            logger.exception(e)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail="Failed to get upload status"
            )

    @router.get(
        path="",
        status_code=HTTPStatus.OK,
        response_model=list[CVUploadResponseListItem],
        responses={
            HTTPStatus.FORBIDDEN: {"model": HTTPErrorResponse},
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
        description="Retrieve all CVs uploaded by the user",
    )
    async def get_user_cvs(
        user_id: str = Path(description="the unique identifier of the user", examples=["1"]),
        user_info: UserInfo = Depends(auth.get_user_info()),
        service: ICVUploadService = Depends(_get_cv_service),
    ) -> list[CVUploadResponseListItem]:
        try:
            if user_info.user_id != user_id:
                raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail="Cannot access CVs for a different user")

            # Get user CVs through the service
            uploads = await service.get_user_cvs(user_id=user_id)

            return [
                CVUploadResponseListItem(
                    upload_id=upload.upload_id,
                    filename=upload.filename,
                    uploaded_at=upload.created_at,
                    upload_process_state=upload.upload_process_state,
                    experiences_data=upload.experience_bullets
                )
                for upload in uploads
            ]

        except HTTPException:
            raise
        except Exception as e:
            logger.exception(e)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve user CVs"
            )

    users_router.include_router(router)


def add_public_report_routes(app: FastAPI):
    router = APIRouter(prefix="/reports", tags=["public-reports"])

    @router.get(
        path="/{identifier}",
        status_code=HTTPStatus.OK,
        response_model=PublicReportResponse,
        responses={
            HTTPStatus.NOT_FOUND: {"model": HTTPErrorResponse},
            HTTPStatus.INTERNAL_SERVER_ERROR: {"model": HTTPErrorResponse},
        },
        description="Retrieve the latest CV report data for a user (Public)",
    )
    async def get_public_report(
        identifier: str = Path(description="registration code or user id", examples=["reg-123", "user-1"]),
        token: str | None = Query(None, description="Security token for accessing the report"),
        user_preferences_repository: IUserPreferenceRepository = Depends(get_user_preferences_repository),
        experience_service: IExperienceService = Depends(get_experience_service),
    ) -> PublicReportResponse:
        try:
            # 0. Validate Security Token if configured
            sec_token = os.getenv("SEC_TOKEN")
            normalized_token = token.casefold() if token else None
            normalized_sec_token = sec_token.casefold() if sec_token else None
            if normalized_sec_token:
                if not normalized_token:
                    log_non_pii_warning(
                        "Security token required but not provided for public CV report",
                        {"identifier_present": bool(identifier)},
                    )
                    raise HTTPException(status_code=HTTPStatus.UNAUTHORIZED, detail="Security token required")
                if normalized_sec_token != normalized_token:
                    log_non_pii_warning(
                        "Invalid security token provided for public CV report",
                        {"identifier_present": bool(identifier)},
                    )
                    raise HTTPException(status_code=HTTPStatus.FORBIDDEN, detail="Invalid security token")

            # 1. Resolve identifier to user preferences (prefer registration_code)
            preferences = await user_preferences_repository.get_user_preference_by_registration_code(identifier)
            if preferences is None:
                preferences = await user_preferences_repository.get_user_preference_by_user_id(identifier)
                registration_code = getattr(preferences, "registration_code", None) if preferences else None
                if registration_code and registration_code != identifier:
                    log_non_pii_warning(
                        "Registration code mismatch when fetching public CV report via user_id",
                        {"identifier_present": bool(identifier), "registration_code_present": True},
                    )
                    raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="No report data found for this user")

            if not preferences or not preferences.sessions:
                logger.warning("No preferences or sessions found for identifier=%s", identifier)
                raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail="No report data found for this user")

            # 2. Use the latest session
            latest_session_id = preferences.sessions[0]

            # 3. Get experiences for the latest session
            experience_entity_list = await experience_service.get_experiences_by_session_id(latest_session_id)
            
            # Map to ExperienceResponse
            experiences = [
                ExperienceResponse.from_experience_entity(
                    experience_entity=entity,
                    dive_in_phase=phase
                )
                for entity, phase in experience_entity_list
            ]

            # TODO: Use the actual conversation end time when available.
            # For now, we infer it from unrelated field `accepted_tc`.
            conducted_at = None
            if hasattr(preferences, "accepted_tc"):  # Just a placeholder for some date
                conducted_at = preferences.accepted_tc

            return PublicReportResponse(
                user_id=preferences.user_id or identifier,
                experiences=experiences,
                conversation_conducted_at=conducted_at
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.exception(e)
            raise HTTPException(
                status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve report data"
            )

    app.include_router(router)
