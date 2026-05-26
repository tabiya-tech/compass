import logging
import textwrap

from app.agent.prompt_template.agent_prompt_template import STD_LANGUAGE_STYLE, STD_LANGUAGE_STYLE_JSON
from app.i18n.translation_service import get_i18n_manager
from app.i18n.types import Locale

logger = logging.getLogger(__name__)


def _get_locale_section():
    language = get_i18n_manager().get_locale()
    language_label = language.label()

    section = textwrap.dedent(f"""
        #Language 
        - CRITICAL: You MUST reply ONLY in {language_label}. Never mix languages or use words from other languages.
        - Any questions I tell you to ask me should also be in the {language_label} language.
        - If my previous message is in another language, do not respond in that language, instead respond in the {language_label} language.
        - Any information or data you are asked to extract from our conversation should also be in or translated to the {language_label} language.
        - If you see text in these instructions or prompts that is not in {language_label}, you MUST translate it to {language_label} before using it in your response.
        - Never mix languages - your entire response must be in {language_label} only.
        """)

    # Swahili-specific guidance
    if language == Locale.SW_KE:
        section += textwrap.dedent("""
        #Swahili Language Guidance
        - Use simple, everyday Kiswahili. Avoid overly formal or literary Swahili.
        - When the user uses Swahili terms for jobs or skills, acknowledge them naturally and use
          the Swahili term in your response alongside any clarification.
        - If the user mixes English and Swahili (code-switching), respond in Kiswahili but you may
          use commonly understood English loan words (e.g., "CV", "email", "computer").
        - Keep the same warm, supportive tone as in English conversations.
        """)

    # Mozambican Portuguese-specific guidance
    elif language == Locale.PT_MZ:
        section += textwrap.dedent("""
        #Mozambican Portuguese Language Guidance
        - Use everyday Mozambican Portuguese. Avoid overly formal or European Portuguese expressions.
        - Prefer vocabulary and phrasing natural to Mozambique (e.g. "trabalho" over "labor",
          everyday greetings like "Olá" rather than "Bom dia, Vossa Excelência").
        - If the user mixes English and Portuguese (common in urban Mozambique), respond fully in
          Portuguese but you may use widely understood English terms (e.g., "CV", "email", "online").
        - Keep the same warm, supportive tone as in English conversations.
        """)

    return section


def _get_swahili_glossary_section() -> str:
    """
    Build a RAG glossary section from the Swahili mapping data.
    Injects a random sample of Swahili terms into the prompt so the LLM
    has grounding for Swahili job/skill vocabulary.
    
    Single source of truth: terms come from swahili_terms.json.
    """
    try:
        from app.i18n.swahili_mapping import SwahiliMappingService
        service = SwahiliMappingService.get_instance()
        sample = service.get_glossary_sample(n=10)
        if not sample:
            return ""
        
        lines = []
        for entry in sample:
            lines.append(f"    {entry['term']} = {entry['normalized']}")

        glossary = "\n".join(lines)
        return textwrap.dedent(f"""
        #Swahili Job Term Reference (for context)
        The following are common Swahili terms for jobs and skills with their English equivalents.
        Use this reference to understand what the user means when they use Swahili job terms:
{glossary}
        """)
    except Exception as e:
        logger.warning("Failed to load Swahili glossary for prompt: %s", e)
        return ""


def get_language_style(*, with_locale: bool = True, for_json_output: bool = False) -> str:
    """
    Get the language style instructions.

    :arg with_locale: Whether to include the locale section. Note that if this is set to True, we expect the locale to be set.
                      Otherwise, an error will be raised.
    :arg for_json_output: Whether the output is expected to be JSON formatted.
    """
    prompt = ""
    if with_locale:
        prompt += _get_locale_section()

        # Add RAG glossary for Swahili locale
        try:
            language = get_i18n_manager().get_locale()
            if language == Locale.SW_KE:
                prompt += _get_swahili_glossary_section()
        except Exception as e:
            logger.warning("Locale lookup failed, skipping glossary: %s", e)

    prompt += STD_LANGUAGE_STYLE_JSON if for_json_output else STD_LANGUAGE_STYLE

    return prompt
