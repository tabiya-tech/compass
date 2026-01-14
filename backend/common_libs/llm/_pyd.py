from typing import Optional

from pydantic import BaseModel

from app.agent.simple_llm_agent.llm_response import ModelResponse
from common_libs.llm.sanitize_schema_for_vertex import sanitize_schema_for_vertex


class SomeValue(BaseModel):
    value: Optional[str]


class MyModel(BaseModel):
    x: Optional[int]
    y: Optional[SomeValue]


serialize_result = sanitize_schema_for_vertex(ModelResponse.model_json_schema())
validation_result = sanitize_schema_for_vertex(ModelResponse.model_json_schema())

# assert serialize_result != validation_result
print(serialize_result)
print(ModelResponse.model_json_schema())