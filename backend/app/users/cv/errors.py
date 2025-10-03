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


class CVLimitExceededError(Exception):
    """Raised when the maximum number of stored CVs is reached."""
    pass


class CVUploadRateLimitExceededError(Exception):
    """Raised when the CV upload rate limit is exceeded."""
    pass


class DuplicateCVUploadError(Exception):
    """Raised when a CV with the same MD5 hash has already been uploaded."""
    def __init__(self, md5_hash: str):
        super().__init__(f"CV with hash {md5_hash} has already been uploaded")
        self.md5_hash = md5_hash
