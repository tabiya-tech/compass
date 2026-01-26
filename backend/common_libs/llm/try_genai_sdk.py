import asyncio
import json
import logging
from typing import Optional

from pydantic import BaseModel

from app.agent.llm_caller import LLMCaller
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, DEFAULT_GENERATION_CONFIG
from common_libs.llm.schema_builder import build_request_schema


class Output(BaseModel):
    current_date: str
    some_additional_field: Optional[str]


class Response(BaseModel):
    current_date: Optional[Output]
    some_additional_field: Optional[bool]

    class Config:
        extra = "forbid"


_instructions = """
What is the date today?
"""


async def main():
    llm = GeminiGenerativeLLM(
        config=LLMConfig(
            generation_config=DEFAULT_GENERATION_CONFIG | {
                "response_mime_type": "application/json",
                "response_schema": build_request_schema(Response)
            }
        )
    )

    print(json.dumps(build_request_schema(Response), indent=3))

    llm_caller = LLMCaller[Response](model_response_type=Response)
    response, _stats = await llm_caller.call_llm(
        llm=llm,
        llm_input=_instructions,
        logger=logging.getLogger(__name__))

    print(_stats)

    print(response)


if __name__ == "__main__":
    asyncio.run(main())

