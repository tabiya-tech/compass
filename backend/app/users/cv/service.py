from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from .utils.markdown_converter import convert_cv_bytes_to_markdown

@dataclass(slots=True)
class ParsedCV:
    experiences_data: str


class ICVUploadService(Protocol):
    async def parse_cv(self, *, user_id: str, file_bytes: bytes, filename: str, content_type: str | None) -> ParsedCV:  # pragma: no cover - interface
        ...


class CVUploadService:
    """Rudimentary service that currently does not store anything.

    For now, simply returns a placeholder ParsedCV with empty experiences_data.
    """

    async def parse_cv(self, *, user_id: str, file_bytes: bytes, filename: str, content_type: str | None) -> ParsedCV:
        # Convert the CV file to Markdown and return it as experiences_data for now.
        markdown_text = convert_cv_bytes_to_markdown(file_bytes, filename)
        return ParsedCV(experiences_data=markdown_text)


