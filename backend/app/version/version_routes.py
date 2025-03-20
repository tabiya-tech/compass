import logging

from fastapi import FastAPI, HTTPException
from app.constants.errors import HTTPErrorResponse
from app.app_config import get_application_config

logger = logging.getLogger(__name__)


def add_version_routes(app: FastAPI):
    """
    Add routes to the FastAPI app to expose the version information.
    """
    @app.get(path="/version",
             status_code=200,
             responses={500: {"model": HTTPErrorResponse}},
             description="""
             Returns the version of the application
             """, )
    async def _get_version():
        try:
            return get_application_config().version_info
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=500, detail="Failed to retrieve the version of the application.")
