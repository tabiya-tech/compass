import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Optional

from app.users.cv.types import UploadProcessState, CVUploadErrorCode
from app.users.cv.constants import MAX_MARKDOWN_CHARS, MARKDOWN_CONVERSION_TIMEOUT_SECONDS, RATE_LIMIT_WINDOW_MINUTES, \
    DEFAULT_MAX_UPLOADS_PER_USER, DEFAULT_RATE_LIMIT_PER_MINUTE
from app.users.cv.errors import MarkdownTooLongError, EmptyMarkdownError, \
    CVUploadRateLimitExceededError, CVLimitExceededError, DuplicateCVUploadError, MarkdownConversionTimeoutError
from app.users.cv.utils.markdown_converter import convert_cv_bytes_to_markdown
from common_libs.call_with_timeout.call_with_timeout import call_with_timeout
from app.users.cv.utils.cv_structured_extractor import CVStructuredExperienceExtractor
from app.users.cv.repository import IUserCVRepository
from app.users.cv.services.state_injection_service import StateInjectionService
from app.application_state import IApplicationStateManager
from app.app_config import get_application_config
from app.users.cv.storage import build_user_cv_upload_record, ICVCloudStorageService


class ICVUploadService(ABC):
    @abstractmethod
    async def parse_cv(self, *,
                       user_id: str,
                       file_bytes: bytes,
                       
                       filename: str) -> str:  # pragma: no cover - interface

        """
        Schedule a CV upload and parsing process.

        :param user_id: The ID of the user uploading the CV.
        :param file_bytes: The raw bytes of the uploaded CV file.
        :param filename: The original filename of the uploaded CV.
        :return: the upload_id
        """
    
    @abstractmethod
    async def cancel_upload(self, *, user_id: str, upload_id: str) -> bool:  # pragma: no cover - interface
        """
        Cancel an ongoing CV upload process.
        Returns True if cancellation was successful, False if upload not found or already completed.
        """
    
    @abstractmethod
    async def get_upload_status(self, *, user_id: str, upload_id: str) -> Optional[dict]:  # pragma: no cover - interface
        """
        Get the status of an upload process.
        Returns upload details if found, None if not found.
        """

    @abstractmethod
    async def get_user_cvs(self, *, user_id: str) -> list[dict]:  # pragma: no cover - interface
        """Return a list of completed uploads for a user (for listing in UI)."""

    @abstractmethod
    async def reinject_upload(self, *, user_id: str, upload_id: str, session_id: int) -> bool:
        """Re-run state injection for a previously uploaded CV."""
        raise NotImplementedError()


class CVUploadService(ICVUploadService):
    """
    CV Upload Service.
    """

    def __init__(self, repository: IUserCVRepository, cv_cloud_storage_service: ICVCloudStorageService,
                 structured_extractor: CVStructuredExperienceExtractor,
                 application_state_manager: IApplicationStateManager | None = None):
        self._background_tasks: set[asyncio.Task] = set()
        self._logger = logging.getLogger(self.__class__.__name__)
        self._structured_extractor = structured_extractor

        self._repository = repository
        self._cv_cloud_storage_service = cv_cloud_storage_service
        self._injection_service: StateInjectionService | None = (
            StateInjectionService(application_state_manager) if application_state_manager else None
        )

    @staticmethod
    def _map_error_code(error: Exception) -> CVUploadErrorCode:
        if isinstance(error, MarkdownTooLongError):
            return CVUploadErrorCode.MARKDOWN_TOO_LONG
        if isinstance(error, EmptyMarkdownError):
            return CVUploadErrorCode.EMPTY_MARKDOWN
        if isinstance(error, (asyncio.TimeoutError, TimeoutError, MarkdownConversionTimeoutError)):
            return CVUploadErrorCode.MARKDOWN_CONVERSION_TIMEOUT
        # Heuristic for storage errors (e.g., google cloud storage exceptions)
        module_name = getattr(error.__class__, "__module__", "").lower()
        if "google" in module_name or "storage" in module_name:
            return CVUploadErrorCode.STORAGE_ERROR
        return CVUploadErrorCode.UNKNOWN_ERROR

    async def _check_cancellation(self, upload_id: Optional[str]) -> None:
        """Check if the upload has been cancelled and raise CancelledError if so."""
        if not upload_id:
            return
        # Prefer DB-backed cancellation (API-triggered) and also consult in-memory manager
        # Check cancellation via repository by upload_id
        record = await self._repository.get_upload_by_upload_id(upload_id)
        if record and record.get("cancel_requested"):
            raise asyncio.CancelledError(f"Upload {upload_id} was cancelled")

    async def _run_with_cancellation(self,
                                     upload_id: str,
                                     fn,
                                     *args,
                                     check_interval_seconds: float = 0.25,
                                     **kwargs):
        """Run an awaitable-producing function while periodically checking for cancellation.

        The provided fn must return an awaitable when called with *args/**kwargs.
        """
        task = asyncio.create_task(fn(*args, **kwargs))
        try:
            while True:
                done, _pending = await asyncio.wait({task}, timeout=check_interval_seconds)
                if task in done:
                    return task.result()
                # Periodically check cancel flag
                await self._check_cancellation(upload_id)
        except asyncio.CancelledError:
            # Propagate cancellation
            if not task.done():
                task.cancel()
            raise
        except Exception:
            # Bubble up errors from the inner task
            if not task.done():
                task.cancel()
            raise

    async def parse_cv(self, *, user_id: str, file_bytes: bytes, filename: str, session_id: int | None = None) -> str:
        self._logger.info("Preparing upload record {filename='%s', size_bytes=%s}", filename, len(file_bytes))
        # We'll run conversion/extraction in background; validations happen there.
        # For immediate response we just need upload_id.
        # Background pipeline will fill experiences; immediate return only includes upload_id
        # Enforce per-user rate limits (lightweight checks before enqueuing)
        app_cfg = get_application_config()

        max_uploads = app_cfg.cv_max_uploads_per_user or DEFAULT_MAX_UPLOADS_PER_USER
        rate_limit_per_min = app_cfg.cv_rate_limit_per_minute or DEFAULT_RATE_LIMIT_PER_MINUTE

        # Enforce per-user max uploads
        total_now = await self._repository.count_uploads_for_user(user_id)
        if total_now >= max_uploads:
            self._logger.warning("User exceeded max CV uploads {user_id=%s, total=%s, limit=%s}", user_id, total_now,
                                 max_uploads)
            raise CVLimitExceededError("Maximum number of CV uploads reached")

        # Enforce a simple per-minute rate limit using time-window count
        recent_now = await self._repository.count_uploads_for_user_in_window(user_id, minutes=RATE_LIMIT_WINDOW_MINUTES)
        if recent_now >= rate_limit_per_min:
            self._logger.warning("Rate limit exceeded for CV uploads {user_id=%s, recent_minute=%s, limit=%s}", user_id,
                                 recent_now, rate_limit_per_min)
            raise CVUploadRateLimitExceededError("Too many CV uploads, try again later")


        try:
            # Build minimal record; markdown stats will be calculated in background after conversion
            user_cv_upload_record = build_user_cv_upload_record(
                user_id=user_id,
                filename=filename,
                markdown_text="",  # placeholder; will recompute
                file_bytes=file_bytes,
            )
            upload_id = user_cv_upload_record.upload_id

            await self._repository.insert_upload(user_cv_upload_record)

            # Kick off background pipeline
            async def _pipeline():
                try:
                    self._logger.info("[Upload %s] Pipeline started for user=%s, filename='%s'", upload_id, user_id, filename)
                    await self._repository.update_state(user_id, upload_id, to_state=UploadProcessState.CONVERTING)
                    # Cancellation-aware markdown conversion
                    self._logger.info("Converting CV to markdown {filename='%s', size_bytes=%s}", filename, len(file_bytes))
                    md = await self._run_with_cancellation(
                        upload_id,
                        call_with_timeout,
                        convert_cv_bytes_to_markdown,
                        timeout_seconds=MARKDOWN_CONVERSION_TIMEOUT_SECONDS,
                        args=(file_bytes, filename, self._logger),
                    )
                    self._logger.info("[Upload %s] Markdown converted {chars=%s}", upload_id, len(md))

                    if not md.strip():
                        raise EmptyMarkdownError(filename)
                    if len(md) > MAX_MARKDOWN_CHARS:
                        raise MarkdownTooLongError(len(md), MAX_MARKDOWN_CHARS)

                    # Cancellation-aware structured extraction (do not persist bullets)
                    await self._repository.update_state(user_id, upload_id, to_state=UploadProcessState.EXTRACTING)
                    _structured = await self._run_with_cancellation(
                        upload_id,
                        self._structured_extractor.extract_structured_experiences,
                        md,
                    )
                    self._logger.info("[Upload %s] Structured experiences extracted {items=%s}", upload_id, _structured.extraction_metadata.get("total_experiences"))

                    # Storage with cancellation
                    await self._repository.update_state(user_id, upload_id, to_state=UploadProcessState.UPLOADING_TO_GCS)
                    await self._run_with_cancellation(
                        upload_id,
                        asyncio.to_thread,
                        self._cv_cloud_storage_service.upload_cv,
                        document=user_cv_upload_record,
                        markdown_text=md,
                        original_bytes=file_bytes,
                    )
                    # Attempt state injection when possible (non-blocking for completion)
                    self._logger.info("[Upload %s] Checking injection conditions: injection_service=%s, session_id=%s", 
                                    upload_id, self._injection_service is not None, session_id)
                    if self._injection_service and session_id is not None:
                        try:
                            self._logger.info("[Upload %s] Starting state injection for session_id=%s", upload_id, session_id)
                            success = await self._injection_service.inject_cv_data(
                                user_id=user_id,
                                session_id=session_id,
                                structured_extraction=_structured,
                            )
                            if success:
                                self._logger.info("[Upload %s] State injection successful", upload_id)
                                await self._repository.mark_state_injected(user_id, upload_id)
                            else:
                                self._logger.warning("[Upload %s] State injection returned False", upload_id)
                                await self._repository.mark_injection_failed(user_id, upload_id, error="State injection failed")
                        except Exception as inj_err:
                            self._logger.error("[Upload %s] Injection failed with exception: %s", upload_id, inj_err, exc_info=True)
                            try:
                                await self._repository.mark_injection_failed(user_id, upload_id, error=str(inj_err))
                            except Exception:
                                self._logger.warning("[Upload %s] Failed to persist injection failure", upload_id)
                    else:
                        if self._injection_service is None:
                            self._logger.info("[Upload %s] Skipping injection: injection_service is None", upload_id)
                        if session_id is None:
                            self._logger.info("[Upload %s] Skipping injection: session_id is None", upload_id)

                    # Mark completed regardless of injection outcome
                    await self._repository.update_state(user_id, upload_id, to_state=UploadProcessState.COMPLETED)
                    self._logger.info("[Upload %s] Pipeline completed successfully", upload_id)
                except asyncio.CancelledError:
                    await self._repository.mark_cancelled(user_id, upload_id)
                    self._logger.info("[Upload %s] Pipeline cancelled", upload_id)
                except Exception as e:
                    self._logger.exception(e)
                    # Persist failure info for polling
                    error_code = self._map_error_code(e).value
                    error_detail = str(e)
                    try:
                        await self._repository.mark_failed(user_id, upload_id, error_code=error_code, error_detail=error_detail)
                    except Exception:
                        self._logger.warning("[Upload %s] Failed to persist FAILED state", upload_id)

            # Keep a strong reference to avoid GC of background task
            if not hasattr(self, "_background_tasks"):
                self._background_tasks: set[asyncio.Task] = set()
            task = asyncio.create_task(_pipeline())
            self._background_tasks.add(task)
            task.add_done_callback(lambda t: self._background_tasks.discard(t))

            # Return immediately with upload_id and empty experiences in business model
            return upload_id
        except DuplicateCVUploadError as e:
            self._logger.warning("Duplicate CV upload detected {user_id=%s, md5_hash=%s}", user_id, e.md5_hash)
            raise
        except Exception as e:
            self._logger.exception(e)
            raise
    
    async def cancel_upload(self, *, user_id: str, upload_id: str) -> bool:
        """
        Cancel an ongoing CV upload process.
        Returns True if cancellation was successful, False if upload not found or already completed.
        """
        try:
            # Request cancellation atomically through the repository
            success = await self._repository.request_cancellation(user_id, upload_id)
            
            if success:
                self._logger.info("Cancellation requested for upload {user_id=%s, upload_id=%s}", user_id, upload_id)
            else:
                self._logger.warning("Failed to cancel upload - not found or already completed {user_id=%s, upload_id=%s}", user_id, upload_id)
            
            return success
            
        except Exception as e:
            self._logger.exception(e)
            return False
    
    async def get_upload_status(self, *, user_id: str, upload_id: str) -> Optional[dict]:
        """
        Get the status of an upload process.
        Returns upload details if found, None if not found.
        """
        try:
            upload_record = await self._repository.get_upload_by_id(user_id, upload_id)
            
            if not upload_record:
                self._logger.debug("Upload not found {user_id=%s, upload_id=%s}", user_id, upload_id)
                return None
            
            # Convert MongoDB document to a clean dict for API response
            status_info = {
                "upload_id": upload_record.get("upload_id"),
                "user_id": upload_record.get("user_id"),
                "filename": upload_record.get("filename"),
                "upload_process_state": upload_record.get("upload_process_state"),
                "cancel_requested": upload_record.get("cancel_requested", False),
                "created_at": upload_record.get("created_at"),
                "last_activity_at": upload_record.get("last_activity_at"),
                "error_code": upload_record.get("error_code"),
                "error_detail": upload_record.get("error_detail"),
                # State injection reporting
                "state_injected": upload_record.get("state_injected"),
                "injection_error": upload_record.get("injection_error"),
                "experience_bullets": upload_record.get("experience_bullets"),
            }
            
            self._logger.debug("Retrieved upload status {user_id=%s, upload_id=%s, state=%s}", 
                             user_id, upload_id, status_info.get("upload_process_state"))
            
            return status_info
            
        except Exception as e:
            self._logger.exception(e)
            return None

    async def get_user_cvs(self, *, user_id: str) -> list[dict]:
        """Return a simplified list of user's uploaded CVs (COMPLETED only)."""
        try:
            uploads = await self._repository.get_user_uploads(user_id=user_id)
            # map to wire format expected by route tests
            out: list[dict] = []
            for u in uploads:
                out.append({
                    "upload_id": u.upload_id,
                    "filename": u.filename,
                    "uploaded_at": u.created_at.isoformat().replace("+00:00", "Z"),
                    "upload_process_state": u.upload_process_state,
                    "experiences_data": u.experience_bullets,
                })
            return out
        except Exception as e:
            self._logger.exception(e)
            raise

    async def reinject_upload(self, *, user_id: str, upload_id: str, session_id: int) -> bool:
        if not self._injection_service:
            self._logger.info(
                "[Upload %s] Reinjection skipped: injection service not configured", upload_id
            )
            return False

        try:
            record = await self._repository.get_upload_by_id(user_id, upload_id)
            if not record:
                self._logger.warning(
                    "[Upload %s] Reinjection failed: upload record not found for user %s",
                    upload_id,
                    user_id,
                )
                return False

            markdown_path = record.get("markdown_object_path")
            if not markdown_path:
                self._logger.warning(
                    "[Upload %s] Reinjection failed: no stored markdown path", upload_id
                )
                return False

            # Load markdown content (may fail if storage is unavailable)
            try:
                markdown_text = await asyncio.to_thread(
                    self._cv_cloud_storage_service.download_markdown,
                    object_path=markdown_path,
                )
            except Exception as storage_error:
                self._logger.error(
                    "[Upload %s] Reinjection failed: unable to download markdown (%s)",
                    upload_id,
                    storage_error,
                )
                return False

            if not markdown_text or not markdown_text.strip():
                self._logger.warning(
                    "[Upload %s] Reinjection aborted: stored markdown empty", upload_id
                )
                return False

            structured = await self._structured_extractor.extract_structured_experiences(markdown_text)

            success = await self._injection_service.inject_cv_data(
                user_id=user_id,
                session_id=session_id,
                structured_extraction=structured,
            )

            if success:
                await self._repository.mark_state_injected(user_id, upload_id)
            else:
                await self._repository.mark_injection_failed(user_id, upload_id, error="Reinjection failed")
            return success

        except Exception as exc:
            self._logger.error(
                "[Upload %s] Reinjection raised exception: %s", upload_id, exc, exc_info=True
            )
            try:
                await self._repository.mark_injection_failed(user_id, upload_id, error=str(exc))
            except Exception:
                self._logger.warning(
                    "[Upload %s] Failed to persist reinjection failure", upload_id
                )
            return False
