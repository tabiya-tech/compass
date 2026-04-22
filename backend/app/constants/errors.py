import logging
from typing import Optional

from pydantic import BaseModel
from fastapi import HTTPException


class HTTPErrorResponse(BaseModel):
    """
    Standard error response body. `detail` is always present; the remaining fields
    are optional so existing clients that only read `detail` remain compatible.
    """
    detail: str
    error_code: Optional[str] = None
    correlation_id: Optional[str] = None
    sentry_event_id: Optional[str] = None

    class Config:
        """
        Pydantic configuration.
        """
        extra = "forbid"


class ErrorService:
    """
    ErrorService class is responsible for handling exceptions and logging them.
    """
    @staticmethod
    def handle(name: str, e: Exception):
        """
        Handle exceptions and log them.
        :param name: name of the handler module
        :param e : exception object
        :return: None
        """

        # Create a logger object
        logger = logging.getLogger(name)

        # Log the exception
        logger.exception(e)

        # Raise HTTPException if the exception is already an instance of HTTPException
        if isinstance(e, HTTPException):
            raise e

        # Raise HTTPException with status code 500 if the exception is not an instance of HTTPException
        raise HTTPException(status_code=500, detail="Oops! Something went wrong.")
