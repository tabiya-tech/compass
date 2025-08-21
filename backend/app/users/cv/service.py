from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


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
        # Placeholder implementation; extraction will be implemented in the next step.
        return ParsedCV(experiences_data="")


