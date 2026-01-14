import copy
from typing import Dict, Any


# TODO: Finish the sanitize schema for vertex
def sanitize_schema_for_vertex(schema: Dict[str, Any]) -> Dict[str, Any]:
    """
    Recursively removes 'anyOf' from the schema and handles nullable fields
    to make Pydantic v2 schemas compatible with Google Vertex AI.
    """

    schema = copy.deepcopy(schema)

    # 1. Handle "anyOf" (commonly used for Optional[T])
    if "anyOf" in schema:
        for sub_schema in schema["anyOf"]:
            if sub_schema.get("type") == "null":
                # It's a nullable field.
                continue

            # Return the first non-null type found (simplification)
            return sanitize_schema_for_vertex(sub_schema)

    # 2. Recursively process properties
    if "properties" in schema:
        for prop_name, prop_schema in schema["properties"].items():
            schema["properties"][prop_name] = sanitize_schema_for_vertex(prop_schema)

    # 3. Recursively process definitions ($defs)
    if "$defs" in schema:
        for def_name, def_schema in schema["$defs"].items():
            schema["$defs"][def_name] = sanitize_schema_for_vertex(def_schema)

    # Clean up title/description if strictly necessary, usually Vertex tolerates them,
    # but sometimes standardizing types is needed.

    if schema.get("additionalProperties", None) is not None:
        del schema["additionalProperties"]

    # TODO: Investigate why
    if schema.get("type_", None) is not None:
        schema["type"] = schema["type_"]
        del schema["type_"]

    return schema
