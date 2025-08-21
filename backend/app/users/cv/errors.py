from __future__ import annotations

from pydantic import Field

from app.constants.errors import HTTPErrorResponse


class MarkdownTooLongError(Exception):
    def __init__(self, length: int, limit: int):
        super().__init__(f"Converted markdown length {length} exceeds limit {limit}")
        self.length = length
        self.limit = limit


class PayloadTooLargeErrorResponse(HTTPErrorResponse):
    detail: str = Field(description="Error message indicating payload exceeded the size limit")


