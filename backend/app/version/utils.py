import asyncio
import json
import logging

from fastapi import HTTPException
from pathlib import Path
from typing import Dict

logger = logging.getLogger(__name__)


async def load_version_info() -> Dict[str, str]:
    # Determine the absolute path of the directory where the current script resides
    script_directory = Path(__file__).parent

    # Construct the absolute path to the JSON file
    version_file_path = script_directory / 'version.json'

    try:
        version_data = await asyncio.to_thread(version_file_path.read_text)
        return json.loads(version_data)
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="Version file not found")
    except Exception as e:
        logger.exception(e)
        raise HTTPException(status_code=500, detail="Failed to load version data")
