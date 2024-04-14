import json
import os

from fastapi import FastAPI


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
             description="""
             Returns the version of the application
             """, )
    async def _get_version():
        return {"version": version_info}
