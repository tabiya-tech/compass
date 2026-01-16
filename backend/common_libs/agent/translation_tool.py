import logging
from textwrap import dedent
from typing import Literal

from pydantic import BaseModel

from app.agent.llm_caller import LLMCaller
from app.i18n.types import Locale
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import JSON_GENERATION_CONFIG, LLMConfig


class _Output(BaseModel):
    text: str


class TranslationTool:
    def __init__(self, target_locale: Locale):
        self._target_locale = target_locale
        self._llm_caller: LLMCaller[_Output] = LLMCaller[_Output](model_response_type=_Output)
        self._llm = GeminiGenerativeLLM(
            config=LLMConfig(generation_config=JSON_GENERATION_CONFIG)
        )

        self._logger = logging.getLogger(self.__class__.__name__)

    def _get_translate_prompt(self, *, user_input: str) -> str:
        _template = dedent("""
            Translate this text:
            {user_input}
            To this language {target_language}
    
            # Output.
    
            {{
                "text": the translated text in {target_language}
            }}
        """)
        return _template.format(target_language=self._target_locale.label(),
                                user_input=user_input)

    def _get_compare_prompt(self, *, user_input: str, translation: str) -> str:
        _template = dedent("""
            Compare the following two texts in this {target_language} language:
            {user_input}
            {translation}
    
            # Output.
    
            {{
                "text": "SIMILAR" if they are semantically equivalent, "DIFFERENT" otherwise.
            }}
        """)

        return _template.format(target_language=self._target_locale.label(),
                                user_input=user_input,
                                translation=translation)

    async def translate(self, text: str) -> str:
        if not text:
            self._logger.warning("Empty text to translate")
            return ""

        llm_input = self._get_translate_prompt(user_input=text)
        translated_text, _llm_stats = await self._llm_caller.call_llm(llm_input=llm_input,
                                                                      llm=self._llm,
                                                                      logger=self._logger)
        return translated_text.text

    async def compare(self, text: str, translation: str) -> Literal["SIMILAR", "DIFFERENT"] | str:
        if not text:
            self._logger.warning("Empty text to translate")

        if not translation:
            self._logger.warning("Empty translation to compare")

        if text == translation:
            return "SIMILAR"

        llm_input = self._get_compare_prompt(user_input=text, translation=translation)
        comparison: _Output | None
        comparison, _llm_stats = await self._llm_caller.call_llm(llm_input=llm_input, llm=self._llm, logger=self._logger)
        return comparison.text
