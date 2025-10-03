import asyncio
import logging
from abc import ABC, abstractmethod

from app.users.cv.types import ParsedCV
from app.users.cv.constants import MAX_MARKDOWN_CHARS, MARKDOWN_CONVERSION_TIMEOUT_SECONDS, RATE_LIMIT_WINDOW_MINUTES
from app.users.cv.errors import MarkdownTooLongError, MarkdownConversionTimeoutError, EmptyMarkdownError, \
    CVUploadRateLimitExceededError, CVLimitExceededError, DuplicateCVUploadError
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
                       filename: str) -> ParsedCV:  # pragma: no cover - interface

        """
        Parse and persist a CV upload, returning extracted experiences.
        """

class CVUploadService(ICVUploadService):
    """
    CV Upload Service.
    """

    def __init__(self, repository: IUserCVRepository, cv_cloud_storage_service: ICVCloudStorageService):
        self._logger = logging.getLogger(self.__class__.__name__)
        self._experiences_extractor = CVExperienceExtractor(self._logger)

        self._repository = repository
        self._cv_cloud_storage_service= cv_cloud_storage_service

    async def parse_cv(self, *, user_id: str, file_bytes: bytes, filename: str) -> ParsedCV:
        # we don't use the user_id for now, but we might use it later when storing the CV
        self._logger.info("Converting CV to markdown {filename='%s', size_bytes=%s}", filename, len(file_bytes))

        # Convert the CV file to Markdown
        try:
            markdown_text = await call_with_timeout(
                convert_cv_bytes_to_markdown,
                timeout_seconds=MARKDOWN_CONVERSION_TIMEOUT_SECONDS,
                args=(file_bytes, filename, self._logger),
            )
        except asyncio.TimeoutError:
            self._logger.warning("Markdown conversion timed out {filename='%s', timeout_sec=%s}", filename, MARKDOWN_CONVERSION_TIMEOUT_SECONDS)
            raise MarkdownConversionTimeoutError(MARKDOWN_CONVERSION_TIMEOUT_SECONDS)

        _markdown_text_length = len(markdown_text)
        self._logger.info("Markdown produced from CV {length_chars=%s}", _markdown_text_length)

        # check business rules, empty/too long markdown
        if not markdown_text.strip():
            self._logger.warning("Markdown conversion returned empty content {filename='%s'}", filename)
            raise EmptyMarkdownError(filename)
        if _markdown_text_length > MAX_MARKDOWN_CHARS:
            self._logger.warning("Converted markdown exceeds max length {length=%s, limit=%s, filename='%s'}",
                                 _markdown_text_length, MAX_MARKDOWN_CHARS, filename)
            raise MarkdownTooLongError(_markdown_text_length, MAX_MARKDOWN_CHARS)

        # Use LLM to extract bulleted experiences directly
        bullets = await self._experiences_extractor.extract_experiences(markdown_text)
        self._logger.info("CV experience extraction complete {items=%s}", len(bullets))
        if not bullets:
            self._logger.error("No experiences extracted from CV {filename='%s'}", filename)
        else:
            self._logger.debug("Extraction preview: %s", "; ".join(list(bullets[:3])))

        # Enforce per user rate limits.
        app_cfg = get_application_config()

        max_uploads = app_cfg.cv_max_uploads_per_user
        rate_limit_per_min = app_cfg.cv_rate_limit_per_minute

        # Enforce per-user max uploads
        total_now = await self._repository.count_uploads_for_user(user_id)
        if total_now >= max_uploads:
            self._logger.warning("User exceeded max CV uploads {user_id=%s, total=%s, limit=%s}", user_id, total_now, max_uploads)
            raise CVLimitExceededError("Maximum number of CV uploads reached")

        # Enforce a simple per-minute rate limit using time-window count
        recent_now = await self._repository.count_uploads_for_user_in_window(user_id, minutes=RATE_LIMIT_WINDOW_MINUTES)
        if recent_now >= rate_limit_per_min:
            self._logger.warning("Rate limit exceeded for CV uploads {user_id=%s, recent_minute=%s, limit=%s}", user_id, recent_now, rate_limit_per_min)
            raise CVUploadRateLimitExceededError("Too many CV uploads, try again later")

        try:
            # Persist the file and Markdown to GCS, record DB entry, enforce limits.
            user_cv_upload_record = build_user_cv_upload_record(
                user_id=user_id,
                filename=filename,
                markdown_text=markdown_text,
                file_bytes=file_bytes,
            )

            self._cv_cloud_storage_service.upload_cv(
                document=user_cv_upload_record,
                markdown_text=markdown_text,
                original_bytes=file_bytes,
            )

            await self._repository.insert_upload(user_cv_upload_record)
        except DuplicateCVUploadError as e:
            self._logger.warning("Duplicate CV upload detected {user_id=%s, md5_hash=%s}", user_id, e.md5_hash)
            raise
        except Exception as e:
            self._logger.exception(e)

        # Return as an array of strings
        return ParsedCV(experiences_data=bullets)
