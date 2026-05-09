"""
On-demand translator used when generating an English-only Skills Report.

Translates the LLM-generated free-text fields of an experience (summary and
normalized_experience_title) into English. Skipped automatically when the
backend i18n locale is already English — in that case the stored fields are
returned as-is with no LLM call.

Reuses the LLMCaller/GeminiGenerativeLLM pattern from ExperienceSummarizer.
"""

import logging
from textwrap import dedent
from typing import Tuple

from pydantic import BaseModel

from app.agent.llm_caller import LLMCaller
from app.i18n.translation_service import get_i18n_manager
from app.i18n.types import Locale
from common_libs.llm.generative_models import GeminiGenerativeLLM
from common_libs.llm.models_utils import LLMConfig
from common_libs.llm.schema_builder import with_response_schema


class ExperienceTranslationResponse(BaseModel):
    summary_en: str
    title_en: str

    class Config:
        extra = "forbid"


_SYSTEM_INSTRUCTIONS = dedent("""\
<System Instructions>
    You are a professional translator. Translate the given fields to natural,
    fluent English suitable for a CV. Preserve meaning, tone, and any technical
    terms (job titles, skills, tools). Do not add commentary, headers, or
    explanations. If a field is already English, return it unchanged.

    Respond with a JSON object with exactly these two fields:
        - summary_en: the English version of the experience summary
        - title_en:   the English version of the experience title
</System Instructions>
""")


def _is_already_english() -> bool:
    """Backend locale check — if the active locale is English, the stored
    summary/title were generated in English and translation is unnecessary."""
    try:
        locale = get_i18n_manager().get_locale()
        return locale in (Locale.EN_GB, Locale.EN_US)
    except Exception:  # pragma: no cover — be defensive; always safe to translate
        return False


def _build_prompt(*, summary: str, title: str) -> str:
    return dedent(f"""\
    <Input>
        Summary: {summary or ""}
        Title:   {title or ""}
    </Input>
    """)


async def translate_experience_text_to_english(
    *,
    summary: str | None,
    normalized_experience_title: str | None,
) -> Tuple[str | None, str | None]:
    """
    Translate the LLM-generated free-text fields of an experience to English.

    Returns (summary_en, normalized_experience_title_en). If the backend locale
    is already English, or if both inputs are empty, returns the inputs
    unchanged without calling the LLM.
    """
    logger = logging.getLogger(__name__)

    if _is_already_english():
        return summary, normalized_experience_title

    has_summary = bool(summary and summary.strip())
    has_title = bool(normalized_experience_title and normalized_experience_title.strip())
    if not has_summary and not has_title:
        return summary, normalized_experience_title

    llm = GeminiGenerativeLLM(
        system_instructions=_SYSTEM_INSTRUCTIONS,
        config=LLMConfig(
            generation_config={"temperature": 0.0, "top_p": 1.0}
            | with_response_schema(ExperienceTranslationResponse)
        ),
    )
    caller: LLMCaller[ExperienceTranslationResponse] = LLMCaller[ExperienceTranslationResponse](
        model_response_type=ExperienceTranslationResponse
    )

    prompt = _build_prompt(
        summary=summary or "",
        title=normalized_experience_title or "",
    )

    response, _stats = await caller.call_llm(llm=llm, llm_input=prompt, logger=logger)

    if response is None:
        # LLM failure — fall back to the original strings rather than failing the report.
        logger.warning(
            "Experience translation failed; falling back to source-language strings."
        )
        return summary, normalized_experience_title

    # If a field was empty on input, keep it None to avoid surfacing model fillers.
    out_summary = response.summary_en if has_summary else summary
    out_title = response.title_en if has_title else normalized_experience_title
    return out_summary, out_title
