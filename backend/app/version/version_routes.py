import json
import os
import logging

from fastapi import FastAPI, HTTPException
from app.constants.errors import HTTPErrorResponse


logger = logging.getLogger(__name__)

def add_version_routes(app: FastAPI):
    """
    Add routes to the FastAPI app to expose the version information.
    """

    # Determine the absolute path of the directory where the current script resides
    script_directory = os.path.dirname(os.path.abspath(__file__))

    # Construct the absolute path to the JSON file, assuming it's in the same directory as the script
    version_file_path = os.path.join(script_directory, 'version.json')

    with open(version_file_path, 'r', encoding='utf-8') as fp:
        version_info = json.load(fp)

    @app.get(path="/version",
             status_code=200,
             responses={500: {"model": HTTPErrorResponse}},
             description="""
             Returns the version of the application
             """, )
    async def _get_version():
        try:
            return version_info
        except Exception as e:
            logger.exception(e)
            raise HTTPException(status_code=500, detail="Failed to retrieve the version of the application.")
