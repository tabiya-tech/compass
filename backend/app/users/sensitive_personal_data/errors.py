"""
This module contains domain-specific exceptions for sensitive personal data.
"""


class DuplicateSensitivePersonalDataError(Exception):
    """
    Exception raised when sensitive personal data already exists for a user.
    """

    def __init__(self, user_id: str):
        super().__init__(f"Sensitive personal data already exists for user {user_id}")


class UserPreferencesNotFoundError(Exception):
    """
    Exception raised when user preferences are not found.
    """

    def __init__(self, user_id: str):
        super().__init__(f"User preferences not found for user {user_id}")


class SensitivePersonalDataRequiredError(Exception):
    """
    Exception raised when sensitive personal data is required but user tries to skip.
    """

    def __init__(self, user_id: str):
        super().__init__(f"Sensitive personal data is required for user {user_id} and cannot be skipped")


class SensitivePersonalDataNotAvailableError(Exception):
    """
    Exception raised when sensitive personal data is not available for a user.
    """

    def __init__(self, user_id: str):
        super().__init__(f"Sensitive personal data is not available for user {user_id}") 