import logging
from typing import Protocol, Optional

from .types import ParsedCV
from .utils.markdown_converter import convert_cv_bytes_to_markdown
from .utils.llm_extractor import CVExperienceExtractor


class ICVUploadService(Protocol):
    async def parse_cv(self, *, user_id: str, file_bytes: bytes, filename: str) -> ParsedCV:  # pragma: no cover - interface
        ...


class CVUploadService:
    """Rudimentary service that currently does not store anything.

    For now, simply returns a placeholder ParsedCV with empty experiences_data.
    """

    def __init__(self, logger: Optional[logging.Logger] = None):
        self._logger = logger or logging.getLogger(self.__class__.__name__)

    async def parse_cv(self, *, user_id: str, file_bytes: bytes, filename: str) -> ParsedCV:
        # we dont use the user_id for now but we might use it later when storing the CV
        # Convert the CV file to Markdown
        markdown_text = convert_cv_bytes_to_markdown(file_bytes, filename, self._logger)
        # Use LLM to extract bulleted experiences directly
        extractor = CVExperienceExtractor(logger=self._logger)
        bullets = await extractor.extract_experiences(markdown_text)
        # Return as array of strings
        return ParsedCV(experiences_data=bullets)


