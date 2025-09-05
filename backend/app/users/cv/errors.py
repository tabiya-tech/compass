from pydantic import Field

from app.constants.errors import HTTPErrorResponse


class MarkdownTooLongError(Exception):
    def __init__(self, length: int, limit: int):
        super().__init__(f"Converted markdown length {length} exceeds limit {limit}")
        self.length = length
        self.limit = limit


class PayloadTooLargeErrorResponse(HTTPErrorResponse):
    detail: str = Field(description="Error message indicating payload exceeded the size limit")


class MarkdownConversionTimeoutError(Exception):
    def __init__(self, timeout_seconds: int):
        super().__init__(f"Markdown conversion exceeded timeout of {timeout_seconds} seconds")
        self.timeout_seconds = timeout_seconds


class EmptyMarkdownError(Exception):
    def __init__(self, filename: str | None = None):
        detail = "Markdown conversion returned empty content"
        if filename:
            detail += f" for '{filename}'"
        super().__init__(detail)
        self.filename = filename

