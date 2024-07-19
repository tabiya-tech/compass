import logging

from pydantic import BaseModel
from fastapi import HTTPException


class HTTPErrorResponse(BaseModel):
    """
    HTTPErrorResponse class is a Pydantic model class that represents the response body of an HTTP error response.
    """
    detail: str


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
        raise HTTPException(status_code=500, detail={
            "message": "Opps! Something went wrong.",
            "cause": e
        })
