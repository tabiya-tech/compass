class UnauthorizedSessionAccessError(Exception):
    """
    Exception raised when there is an attempt to read or write to a session that is not owned by the requesting user
    """
    def __init__(self, user_id: str, session_id: int):
        message = f"User {user_id} is not authorized to access session {session_id}"
        super().__init__(message)


