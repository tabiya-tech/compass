import json
from typing import TypeVar, Type, Any
import re

from pydantic import BaseModel
import fix_busted_json
import json_repair
import logging

logger = logging.getLogger(__name__)

T = TypeVar('T', bound=BaseModel)

# Regular expression to match simple JSON objects
# Working with list of objects is complicated, so we will not support it for now
_JSON_REGEX = r'\{.*\}'


def extract_json(text: str, model: Type[T]) -> T:
    """
    Extract a JSON object from a text and validate it with a Pydantic model.
    Capable of extracting JSON objects from Markdown code blocks and plain text.
    Capable of repairing broken JSON objects.
    :param text: The text to extract the JSON object from
    :param model: The Pydantic model to validate the JSON object
    :return: An instance of the Pydantic model if the JSON object is valid, otherwise raise an exception
    :raises NoJSONFound: If no JSON object is found in the text
    :raises InvalidJSON: If the extracted JSON is invalid
    :raises ValidationError: If the extracted JSON does not conform to the model
    """
    match = re.search(_JSON_REGEX, text, re.DOTALL)
    if not match:
        raise NoJSONFound(f"No JSON object found in the text: {text}")

    # This will not `IndexError` if no match, as we check for it above.
    extracted_text = match.group(0)

    # First, try to get the JSON using fix_busted_json
    # If that fails, try the json_repair library as a second option
    data: Any = None
    try:
        data = try_fix_busted_json(extracted_text)
    except InvalidJSON:
        try:
            data = try_json_repair(extracted_text)
            if data == {}:
                logger.warning("Empty JSON object found, after trying to repair with fix_busted_json for text: %s", text)
        except InvalidJSON:
            raise InvalidJSON("Failed to repair JSON with both json_repair and fix_busted_json")

    try:
        return model(**data)
    except Exception as e:  # pylint: disable=broad-except
        raise ExtractedDataValidationError(f"Failed to construct model: {model.__name__}"
                                           f"\n  - with data: {data}") from e


def try_json_repair(txt: str) -> Any:
    try:
        cleaned_json = json_repair.repair_json(txt, skip_json_loads=True)
        return json.loads(cleaned_json)
    except Exception as e:  # pylint: disable=broad-except
        logger.warning("Failed to repair JSON with json_repair:"
                       "\n  - error: %s"
                       "\n  - text to repair: %s", e, txt)
        raise InvalidJSON(f"Failed to clean JSON with json_repair: {e}") from e


def try_fix_busted_json(txt: str) -> Any:
    try:
        # Parse the JSON text and validate it with the Pydantic model
        cleaned_json = fix_busted_json.repair_json(txt)
        return json.loads(cleaned_json)
    except Exception as e:  # pylint: disable=broad-except
        logger.warning("Failed to repair JSON with fix_busted_json:"
                       "\n  - error: %s"
                       "\n  - text to repair: %s", e, txt)
        raise InvalidJSON(f"Failed to clean JSON with fix_busted_json: {e}") from e


class ExtractJSONError(Exception):
    """Base class for extracting JSON exceptions"""


class InvalidJSON(ExtractJSONError):
    """Raised when the extracted JSON is invalid"""


class NoJSONFound(ExtractJSONError):
    """Raised when no JSON is found in the text"""


class ExtractedDataValidationError(ExtractJSONError):
    """Raised when the extracted JSON does not conform to the model"""
