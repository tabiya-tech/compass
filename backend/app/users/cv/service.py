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
from app.users.cv.utils.llm_extractor import CVExperienceExtractor
from app.users.cv.repository import IUserCVRepository
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


class CVUploadService(ICVUploadService):
    """
    CV Upload Service.
    """

    def __init__(self, repository: IUserCVRepository, cv_cloud_storage_service: ICVCloudStorageService):
        self._background_tasks: set[asyncio.Task] = set()
        self._logger = logging.getLogger(self.__class__.__name__)
        self._experiences_extractor = CVExperienceExtractor(self._logger)

        self._repository = repository
        self._cv_cloud_storage_service = cv_cloud_storage_service

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

    async def parse_cv(self, *, user_id: str, file_bytes: bytes, filename: str) -> str:
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

                    # Cancellation-aware extraction
                    await self._repository.update_state(user_id, upload_id, to_state=UploadProcessState.EXTRACTING)
                    bullets_local = await self._run_with_cancellation(
                        upload_id,
                        self._experiences_extractor.extract_experiences,
                        md,
                    )
                    self._logger.info("[Upload %s] Experiences extracted {items=%s}", upload_id, len(bullets_local))

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
                    # Persist extracted experiences, then mark completed
                    try:
                        await self._repository.store_experiences(user_id, upload_id, experiences=bullets_local)
                    except Exception as e_store:
                        self._logger.warning("[Upload %s] Failed to persist experiences_data", upload_id, str(e_store), exc_info=True)
                    await self._repository.update_state(user_id, upload_id, to_state=UploadProcessState.COMPLETED)
                    self._logger.info("[Upload %s] Pipeline completed successfully", upload_id)
                except asyncio.CancelledError:
                    await self._repository.mark_cancelled(user_id, upload_id)
                    self._logger.info("[Upload %s] Pipeline cancelled", upload_id)
                except Exception as e_pipeline:
                    self._logger.exception(e_pipeline)
                    # Persist failure info for polling
                    error_code = self._map_error_code(e_pipeline).value
                    error_detail = str(e_pipeline)
                    try:
                        await self._repository.mark_failed(user_id, upload_id, error_code=error_code, error_detail=error_detail)
                    except Exception as e_mark_failed:
                        self._logger.warning("[Upload %s] Failed to persist FAILED state", upload_id, str(e_mark_failed), exc_info=True)

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
                "experience_bullets": upload_record.get("experience_bullets"),
            }
            
            self._logger.debug("Retrieved upload status {user_id=%s, upload_id=%s, state=%s}", 
                             user_id, upload_id, status_info.get("upload_process_state"))
            
            return status_info
            
        except Exception as e:
            self._logger.exception(e)
            return None
