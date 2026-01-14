from typing import Any, Dict, Type

from pydantic import BaseModel


def resolve_refs(definitions, node: dict) -> Any:
    """
    Recursively resolves $ref in the node using definitions from defs.
    """

    if isinstance(node, dict):
        if "$ref" in node:
            ref_name = node["$ref"].split("/")[-1]
            if ref_name in definitions:
                # Resolve the reference and merge any other keys (though usually $ref is standalone)
                # We recursively clean the resolved definition
                resolved = resolve_refs(definitions, definitions[ref_name])
                return resolved

        new_node = {}
        for key, value in node.items():
            new_node[key] = resolve_refs(definitions, value)

        return new_node
    elif isinstance(node, list):
        return [resolve_refs(definitions, item) for item in node]
    else:
        return node


def clean_node(node: dict) -> dict | list:
    if isinstance(node, dict):
        if "anyOf" in node:
            # Target schema does NOT support anyOf/oneOf.
            # We must flatten it.
            # Strategy:
            # 1. Check for the 'null' type to set nullable=True.
            # 2. Pick the first non-null type.
            # 3. If multiple non-null types exist, we can't represent it fully.
            #    For now, picking the first non-null is the safest bet for Optional[T].

            options = node["anyOf"]
            nullable = False
            selected_option = None

            for option in options:
                if option.get("type") == "null":
                    nullable = True
                else:
                    if selected_option is None:
                        selected_option = option

            if selected_option:
                # Recursively clean the selected option
                cleaned = clean_node(selected_option)
                if nullable:
                    cleaned["nullable"] = True
                return cleaned
            else:
                return {"type_": "TYPE_UNSPECIFIED"}

        # --- STANDARD CLEANING ---
        new_node = {}
        for k, v in node.items():
            # Keys to exclude
            if k in ["$defs", "definitions", "additionalProperties"]:
                continue

            # Keys to keep/transform
            if k == "type":
                # Rename 'type' -> 'type_' and uppercase
                new_node["type_"] = v.upper() if isinstance(v, str) else v
            elif k == "format":
                new_node["format_"] = v
            elif k == "description":
                new_node["description"] = v
            elif k == "enum":
                new_node["enum"] = v
            elif k == "items":
                new_node["items"] = clean_node(v)
            elif k == "properties":
                new_node["properties"] = {pk: clean_node(pv) for pk, pv in v.items()}
            elif k == "required":
                new_node["required"] = v
            else:
                # Keep other keys recursively cleaned (e.g. minLength, etc.)
                new_node[k] = clean_node(v)
        return new_node

    elif isinstance(node, list):
        return [clean_node(item) for item in node]

    return node


def build_request_schema(pydantic_class: Type[BaseModel]) -> Dict[str, Any]:
    """
    Converts Pydantic class schema to the Google AI Platform open api specification -- a subset of OpenAPI 3.0 --
    ref: https://github.com/googleapis/python-aiplatform/blob/main/google/cloud/aiplatform_v1/types/openapi.py#L64


    Steps:
        1. Resolve definitions ($defs/$ref)
        2. Clean the schema for Vertex AI
    """

    # 1. convert the Pydantic model to OpenAPI 3.0 JSON Schema
    schema = pydantic_class.model_json_schema()

    # 2. since pydantic uses $defs for definitions, extract them using this key
    definitions = schema.get("$defs", {})

    # 3. Resolve all the references.
    resolved_schema = resolve_refs(definitions, schema)

    # clean the node for the target schema
    cleaned_schema = clean_node(resolved_schema)

    return cleaned_schema


def with_response_schema(pydantic_class: Type[BaseModel]):
    return {
        "response_mime_type": "application/json",
        "response_schema": build_request_schema(pydantic_class)
    }
