import logging
from typing import Protocol

from .types import ParsedCV
from .utils.markdown_converter import convert_cv_bytes_to_markdown
from .utils.llm_extractor import CVExperienceExtractor


class ICVUploadService(Protocol):
    async def parse_cv(self, *, user_id: str, file_bytes: bytes, filename: str, content_type: str | None) -> ParsedCV:  # pragma: no cover - interface
        ...


class CVUploadService:
    """Rudimentary service that currently does not store anything.

    For now, simply returns a placeholder ParsedCV with empty experiences_data.
    """

    async def parse_cv(self, *, user_id: str, file_bytes: bytes, filename: str, content_type: str | None) -> ParsedCV:
        logger = logging.getLogger(self.__class__.__name__)
        # Convert the CV file to Markdown
        markdown_text = convert_cv_bytes_to_markdown(file_bytes, filename, logger)
        # Use LLM to extract bulleted experiences directly
        extractor = CVExperienceExtractor(logger=logger)
        bullets = await extractor.extract_experiences(markdown_text)
        # Return as array of strings
        return ParsedCV(experiences_data=bullets)


