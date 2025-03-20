import json
import os

from app.version.types import Version


def load_version_info() -> Version:
    # Determine the absolute path of the directory where the current script resides
    script_directory = os.path.dirname(os.path.abspath(__file__))

    # Construct the absolute path to the JSON file, assuming it's in the same directory as the script
    version_file_path = os.path.join(script_directory, 'version.json')

    try:
        with open(version_file_path, 'r', encoding='utf-8') as fp:
            return Version(**(json.load(fp)))
    except FileNotFoundError:
        raise RuntimeError("Version file not found")
    except Exception as e:
        raise RuntimeError("Failed to load version data", e)
