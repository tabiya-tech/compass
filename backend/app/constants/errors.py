from pydantic import BaseModel


class HTTPErrorResponse(BaseModel):
    detail: str
