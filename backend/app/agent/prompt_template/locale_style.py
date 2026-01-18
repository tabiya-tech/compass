import textwrap

from app.agent.prompt_template.agent_prompt_template import STD_LANGUAGE_STYLE, STD_LANGUAGE_STYLE_JSON
from app.i18n.translation_service import get_i18n_manager


def _get_locale_section():
    language = get_i18n_manager().get_locale()
    language_label = language.label()

    return textwrap.dedent(f"""
        #Language 
        - CRITICAL: You MUST reply ONLY in {language_label}. Never mix languages or use words from other languages.
        - Any questions I tell you to ask me should also be in the {language_label} language.
        - If my previous message is in another language, do not respond in that language, instead respond in the {language_label} language.
        - Any information or data you are asked to extract from our conversation should also be in or translated to the {language_label} language.
        - If you see text in these instructions or prompts that is not in {language_label}, you MUST translate it to {language_label} before using it in your response.
        - Never mix languages - your entire response must be in {language_label} only.
        """)


def get_language_style(*, with_locale: bool = True, for_json_output: bool = False) -> str:
    """
    Get the language style instructions.

    :arg with_locale: Whether to include the locale section. Note that if this is set to True, we expect the locale to be set.
                      Otherwise, an error will be raised.

    """
    prompt = ""
    if with_locale:
        prompt += _get_locale_section()

    prompt += STD_LANGUAGE_STYLE_JSON if for_json_output else STD_LANGUAGE_STYLE

    return prompt
