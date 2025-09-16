import json
import logging
from textwrap import dedent
from typing import Any

from pydantic import BaseModel

from app.agent.experience import ExperienceEntity
from app.agent.llm_caller import LLMCaller
from app.agent.prompt_template.format_prompt import replace_placeholders_with_indent
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig, MEDIUM_TEMPERATURE_GENERATION_CONFIG, JSON_GENERATION_CONFIG
from evaluation_tests.matcher import encode_mixed


def _get_system_instructions() -> str:
    """
    Returns the system instructions for the LLM.
    """
    return dedent("""\
    # Task
        You are given a list of actual user experience entries (such as jobs or volunteer roles) and a list of expected experiences. 
        Your job is to match each experience entry from the expected to the most appropriate actual experience based on semantic similarity, 
        even if the wording or formatting differs.
    
        Use fuzzy matching and semantic understanding to evaluate equivalence. 
        If the experience is clearly related in meaning, treat it as a match even if there are small differences in location, phrasing, or start/end dates.
        Every expected experience must be matched to the most relevant actual experience only once.
        If there are multiple actual experiences that match the same expected experience, choose the one that is the best fit.
        If an expected experience does not match any actual experience, return it as unmatched and fail the match and return match_success as false.
        
    # Response Format
        Your response must always be a JSON object with the following schema:
        {
            "explanation": "<string>",  # Explanation of the match result
            "matches": [[expected, actual]]  # List of matches between expected and actual experiences tuples
            "score": <integer>  # Score of the match result as a percentage (0-100)
            "match_success": <boolean>,  # Whether the actual and expected results match            
        }
    """)


def _get_prompt(actual: list[ExperienceEntity], expected: list[dict]) -> str:
    """
    Returns the prompt for the LLM.
    """
    prompt_template = dedent("""\
    # Actual 
        {actual_json}
        
    # Expected   
        {expected_json}
    """)
    actual_json = json.dumps(actual, default=_get_actual_json, indent=2)
    expected_json = json.dumps(expected, default=encode_mixed, indent=2)
    return replace_placeholders_with_indent(
        template_string=prompt_template,
        actual_json=actual_json,
        expected_json=expected_json)


def _get_actual_json(actual: ExperienceEntity) -> str:
    """
    Returns the actual experience entity as a string.
    """
    return actual.model_dump(mode="json", exclude={"uuid", "responsibilities", "esco_occupations", "top_skills"})


class MatchResult(BaseModel):
    explanation: str
    """
    Explanation of the match result.
    """
    matches: list[list[Any]]
    """
    List of matches between expected and actual experiences.
    """

    match_success: bool
    """
    Whether the actual and expected results match.
    """

    score: int
    """
    Score of the match result.
    """


class ExperiencesDiscoveredEvaluator:

    def __init__(self):
        # Use GeminiGenerativeLLM as the LLM for evaluation
        self.llm = GeminiGenerativeLLM(
            config=LLMConfig(
                language_model_name="gemini-2.0-flash-001",
                generation_config=MEDIUM_TEMPERATURE_GENERATION_CONFIG | JSON_GENERATION_CONFIG

            ),
            system_instructions=_get_system_instructions()
        )
        self.llm_caller: LLMCaller[MatchResult] = LLMCaller(MatchResult)
        self._logger = logging.getLogger(self.__class__.__name__)

    async def evaluate(self, actual: list[ExperienceEntity], expected: list[dict]) -> MatchResult | None:
        response, _ = await self.llm_caller.call_llm(
            llm=self.llm,
            llm_input=_get_prompt(actual, expected),
            logger=self._logger)
        if response is None:
            self._logger.error("LLM response is None")
            return None
        return response
