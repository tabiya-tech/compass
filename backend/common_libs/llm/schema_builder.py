from typing import Any, Dict, Type

from pydantic import BaseModel


def with_response_schema(pydantic_class: Type[BaseModel]) -> Dict[str, Any]:
    """
    The generation config entries that make the LLM respond with a JSON object that follows the pydantic class
    (structured output).

    The pydantic class itself is carried, not a converted schema: each LLM provider turns it into the schema format
    of its API (e.g. `pydantic_class.model_json_schema()` for the google-genai Interactions API). The descriptions of
    the fields (`Field(description=...)`) are part of the schema, so they guide the LLM on what to put in each field.
    """
    return {
        "response_mime_type": "application/json",
        "response_schema": pydantic_class,
    }
