import json
import logging
from typing import Optional

from textwrap import dedent

from pydantic import BaseModel

from app.agent.agent_types import LLMStats
from app.agent.llm_caller import LLMCaller
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, MODERATE_TEMPERATURE_GENERATION_CONFIG, JSON_GENERATION_CONFIG

from .utils import LEVEL_TO_PROMPT, IcatusFirstLevelNode, IcatusSecondLevelNode, TopLevelDivision

class ClassificationLLMResponse(BaseModel):
    icatus_node: TopLevelDivision | IcatusFirstLevelNode | IcatusSecondLevelNode
    llm_stats: list[LLMStats]


class _ClassificationLLMOutput(BaseModel):
    reasoning: Optional[str]
    code: str


def _get_prompt(*,
                experience_title: str,
                responsibilities: list[str],
                ):
    return dedent(""" \
        <Input>
            'Experience Title': {experience_title}
            'Responsibilities': {responsibilities}
        </Input>    
        """).format(
        experience_title=experience_title,
        responsibilities=json.dumps(responsibilities),
    )


class _IcatusClassificationLLM:
    def __init__(self,
                 classification_level: int,
                 logger: logging.Logger):
        self.classification_level = classification_level
        self._llm = GeminiGenerativeLLM(
            system_instructions=LEVEL_TO_PROMPT[self.classification_level],
            # Even if we are generating a JSON output, we still need to set the generation config to MODERATE_TEMPERATURE_GENERATION_CONFIG
            # as we want to generate a more creative response.
            config=LLMConfig(generation_config=MODERATE_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG)
        )
        self._llm_caller: LLMCaller[_ClassificationLLMOutput] = LLMCaller[_ClassificationLLMOutput](
            model_response_type=_ClassificationLLMOutput)
        self._logger = logger

    async def execute(
            self, *,
            experience_title: str,
            responsibilities: list[str],
    ) -> ClassificationLLMResponse:
        """
        Returns a classified Icatus Node depending on the experience title and responsibilities.
        """

        prompt = _get_prompt(
            experience_title=experience_title,
            responsibilities=responsibilities,
        )
        llm_response, llm_stats = await self._llm_caller.call_llm(
            llm=self._llm,
            llm_input=prompt,
            logger=self._logger
        )
        if not llm_response.code:
            self._logger.warning("Failed to classify the experience.")
            raise ValueError("Experience was not classified correctly.")
        if self.classification_level == 0:
            self._logger.info(f"The LLM returned the code {llm_response.code} with reasoning {llm_response.reasoning}.")
            return ClassificationLLMResponse(
                icatus_node=TopLevelDivision(llm_response.code),
                llm_stats=llm_stats
            )
        elif self.classification_level == 1:
            self._logger.info(f"The LLM returned the code {llm_response.code} with reasoning {llm_response.reasoning}.")
            return ClassificationLLMResponse(
                icatus_node=IcatusFirstLevelNode(llm_response.code),
                llm_stats=llm_stats
            )
        elif self.classification_level == 2:
            self._logger.info(f"The LLM returned the code {llm_response.code} with reasoning {llm_response.reasoning}.")
            return ClassificationLLMResponse(
                icatus_node=IcatusSecondLevelNode(llm_response.code),
                llm_stats=llm_stats
            )
        raise ValueError("Classification level not supported.")
