import json
from typing import TypeVar, Type
import re

from pydantic import BaseModel

from fix_busted_json import repair_json

T = TypeVar('T', bound=BaseModel)

# Regular expression to match simple JSON objects
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
        raise NoJSONFound("No JSON object found in the text")

    extracted_text = match.group(0)
    try:
        # Parse the JSON text and validate it with the Pydantic model
        cleaned_json = repair_json(extracted_text)
    except Exception as e:  # pylint: disable=broad-except
        raise InvalidJSON(f"Failed to clean JSON: {e}") from e

    try:
        # Parse the JSON text and validate it with the Pydantic model
        data = json.loads(cleaned_json)
        return model(**data)
    except json.JSONDecodeError as e:
        raise InvalidJSON(f"Failed to decode JSON: {e}") from e
    except Exception as e:  # pylint: disable=broad-except
        raise ValidationError(f"Failed to validate JSON: {e}") from e


class ExtractJSONError(Exception):
    """Base class for extracting JSON exceptions"""


class InvalidJSON(ExtractJSONError):
    """Raised when the extracted JSON is invalid"""


class NoJSONFound(ExtractJSONError):
    """Raised when no JSON is found in the text"""


class ValidationError(ExtractJSONError):
    """Raised when the extracted JSON does not conform to the model"""
