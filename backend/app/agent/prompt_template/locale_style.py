import textwrap
from typing import Literal

from app.agent.prompt_template.agent_prompt_template import STD_LANGUAGE_STYLE
from app.i18n.translation_service import get_i18n_manager


def get_conversation_locale_style_paragraph() -> str:
    """
    Get the locale instructions for agents/tools that compute user responses (Questions & Answers).
    """

    language = get_i18n_manager().get_conversation_locale()
    language_label = language.label()

    return textwrap.dedent(f"""
        #Language 
        - CRITICAL: You MUST return responses ONLY in {language_label}. Never mix languages or use words from other languages.
        - Any questions I tell you to ask me should also be in the {language_label} language.
        - If my previous message is in another language, do not respond in that language, instead respond in the {language_label} language.
        - If you see text in these instructions or prompts that is not in {language_label}, you MUST translate it to {language_label} before using it in your response.
        - Never mix languages - your entire response values must be in {language_label} only.
        """)


def get_state_locale_style_paragraph() -> str:
    """
    Get the locale instructions for agents/tools that return data which is to be written in application state.
    """

    language = get_i18n_manager().get_reporting_locale()
    language_label = language.label()

    return textwrap.dedent(f"""
        #Language for Data Extraction and State Updates
        - CRITICAL: All responses, details, entities, and information you return MUST be in {language_label}.
        - Any information or data you extract from the conversation should be translated to {language_label} before being returned.
        - When classifying, categorizing, or labeling data, use {language_label} terminology.
        - If the user provides information in another language, extract it and translate it to {language_label} for storage.
        - Never mix languages - your entire response values must be in {language_label} only.
        """)


def get_language_style(*,
                       with_locale: bool = True,
                       prompt_intent: Literal["user_message", "application_state"] = "user_message") -> str:
    """
    Get the language style instructions.

    :arg with_locale: Whether to include the locale section. Note that if this is set to True, 
                      we expect the locale to be set. Otherwise, an error will be raised.
    :arg prompt_intent: The intent of the prompt. If it is "user_message", then we will include the locale style for

    """
    prompt = ""
    if with_locale:
        if prompt_intent == "application_state":
            prompt += get_state_locale_style_paragraph()
        else:
            prompt += get_conversation_locale_style_paragraph()

    prompt += STD_LANGUAGE_STYLE

    return prompt
