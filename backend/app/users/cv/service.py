import logging
from typing import Protocol, Optional

from app.users.cv.types import ParsedCV
from app.users.cv.constants import MAX_MARKDOWN_CHARS, MARKDOWN_CONVERSION_TIMEOUT_SECONDS
from app.users.cv.errors import MarkdownTooLongError, MarkdownConversionTimeoutError, EmptyMarkdownError
from app.users.cv.utils.markdown_converter import convert_cv_bytes_to_markdown
from common_libs.call_with_timeout.call_with_timeout import call_with_timeout
from app.users.cv.utils.llm_extractor import CVExperienceExtractor
import asyncio


class ICVUploadService(Protocol):
    async def parse_cv(self, *, user_id: str, file_bytes: bytes,
                       filename: str) -> ParsedCV:  # pragma: no cover - interface
        ...


class CVUploadService:
    """Rudimentary service that currently does not store anything.

    For now, simply returns a placeholder ParsedCV with empty experiences_data.
    """

    def __init__(self, logger: Optional[logging.Logger] = None):
        self._logger = logger or logging.getLogger(self.__class__.__name__)

    async def parse_cv(self, *, user_id: str, file_bytes: bytes, filename: str) -> ParsedCV:
        # we dont use the user_id for now but we might use it later when storing the CV
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
        self._logger.info("Markdown produced from CV {length_chars=%s}", len(markdown_text))

        # check business rules, empty/too long markdown
        if not markdown_text.strip():
            self._logger.warning("Markdown conversion returned empty content {filename='%s'}", filename)
            raise EmptyMarkdownError(filename)
        if len(markdown_text) > MAX_MARKDOWN_CHARS:
            self._logger.warning("Converted markdown exceeds max length {length=%s, limit=%s, filename='%s'}",
                                len(markdown_text), MAX_MARKDOWN_CHARS, filename)
            raise MarkdownTooLongError(len(markdown_text), MAX_MARKDOWN_CHARS)
        # Use LLM to extract bulleted experiences directly
        extractor = CVExperienceExtractor(logger=self._logger)
        bullets = await extractor.extract_experiences(markdown_text)
        self._logger.info("CV experience extraction complete {items=%s}", len(bullets))
        if not bullets:
            self._logger.error("No experiences extracted from CV {filename='%s'}", filename)
        else:
            self._logger.debug("Extraction preview: %s", "; ".join([b for b in bullets[:3]]))
        # Return as array of strings
        return ParsedCV(experiences_data=bullets)
