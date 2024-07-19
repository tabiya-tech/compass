from pydantic import BaseModel


class NewSessionResponse(BaseModel):
    """
    The response to a new session request
    """
    session_id: int
    """The session id for the new session"""

    class Config:
        extra = "forbid"
