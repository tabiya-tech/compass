class SkillsRankingServiceError(Exception):
    """Base exception for skills-ranking-service client failures."""

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class SkillsRankingServiceHTTPError(SkillsRankingServiceError):
    def __init__(self, status_code: int, body: str):
        super().__init__(f"Upstream HTTP {status_code}: {body}")
        self.status_code = status_code
        self.body = body


class SkillsRankingServiceTimeoutError(SkillsRankingServiceError):
    def __init__(self, details: str | None = None):
        super().__init__(f"Timeout while calling skills-ranking-service{': ' + details if details else ''}")
        self.details = details


class SkillsRankingServiceRequestError(SkillsRankingServiceError):
    def __init__(self, details: str | None = None):
        super().__init__(f"Request error while calling skills-ranking-service{': ' + details if details else ''}")
        self.details = details


class SkillsRankingGenericError(SkillsRankingServiceError):
    """Generic error thrown by the state service after logging specific errors."""
    def __init__(self, message: str = "Skills ranking service error"):
        super().__init__(message)


